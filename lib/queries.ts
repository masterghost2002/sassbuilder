"use server"
import { clerkClient, currentUser } from "@clerk/nextjs"
import { db } from "./db";
import { redirect } from "next/navigation";
import { User } from "@prisma/client";

// types
type SAVE_ACTIVITY_LOGS_NOTIFICATION = {
    agencyId?: string,
    description: string,
    subaccountId?: string
}
//server actions files
export const getAuthUserDetails = async () => {
    const user = await currentUser();
    if (!user) return;
    const userData = await db.user.findUnique({
        where: {
            email: user.emailAddresses[0].emailAddress
        },
        include: {
            Agency: {
                include: {
                    SidebarOption: true,
                    SubAccount: {
                        include: {
                            SidebarOption: true
                        }
                    }
                }
            },
            Permissions: true
        }
    });
    return userData;
}

export const saveActivityLogsNotification = async ({ agencyId, description, subaccountId }: SAVE_ACTIVITY_LOGS_NOTIFICATION) => {
    const authUser = await currentUser();
    let userData;
    if (!authUser) {
        const response = await db.user.findFirst({
            where: {
                Agency: {
                    SubAccount: {
                        some: { id: subaccountId },
                    }
                }
            }
        });
        if (response) userData = response;
    }
    else {
        userData = await db.user.findUnique({
            where: {
                email: authUser?.emailAddresses[0].emailAddress
            }
        })
    }
    if (!userData) return;
    let foundAgencyId = agencyId;
    if (!foundAgencyId) {
        if (!subaccountId)
            throw new Error("You need to provide agency Id or subaccount Id");
        const response = await db.subAccount.findUnique({
            where: { id: subaccountId }
        });
        if (response) foundAgencyId = response.agencyId
    }
    if (subaccountId) {
        await db.notification.create({
            data: {
                notification: `${userData.name} | ${description}`,
                User: {
                    connect: {
                        id: userData.id
                    }
                },
                Agency: {
                    connect: {
                        id: foundAgencyId
                    }
                },
                SubAccount: {
                    connect: {
                        id: subaccountId
                    }
                }
            }
        })
    }
    else {
        await db.notification.create({
            data: {
                notification: `${userData.name} | ${description}`,
                User: {
                    connect: {
                        id: userData.id
                    }
                },
                Agency: {
                    connect: {
                        id: foundAgencyId
                    }
                }
            }
        })
    }
}
export const createTeamUser = async (agencyId: string, user: User) => {
    if (user.role === 'AGENCY_OWNER') return null;
    const response = await db.user.create({ data: user });
    return response;
}
export const verifyAndAcceptInvitation = async () => {

    // get the details of the current user
    const user = await currentUser();
    if (!user) return redirect('/sign-in');

    // check does the user have the invitation and the invitation is in pending state, as we now a user can belong to single agency
    // if the invitation is pending thats mean the user does not exits
    const invitationExists = await db.invitation.findUnique({
        where: {
            email: user.emailAddresses[0].emailAddress,
            status: 'PENDING'
        }
    });

    // if the invitation extits create the user
    if (invitationExists) {
        const _user = {
            email: invitationExists.email,
            agencyId: invitationExists.agencyId,
            avatarUrl: user.imageUrl,
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            role: invitationExists.role,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        const userDetails = await createTeamUser(invitationExists.agencyId, _user);
        await saveActivityLogsNotification({
            agencyId: invitationExists.agencyId,
            description: `Joined`,
            subaccountId: undefined
        });
        if (userDetails) {
            await clerkClient.users.updateUserMetadata(user.id, {
                privateMetadata: {
                    role: userDetails.role || 'SUBACCOUNT_USER'
                }
            });
            await db.invitation.delete({where:{email:userDetails.email}});
            return userDetails.agencyId;
        }
        else return null;
    }
    else {
        const _user = await db.user.findUnique({
            where:{
                email:user.emailAddresses[0].emailAddress
            }
        });
        return _user? _user.agencyId : null;
    }
}