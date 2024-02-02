import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getAuthUserDetails, verifyAndAcceptInvitation } from "@/lib/queries";
const AgencyPage = async ()=>{
    const authUser = await currentUser();
    if(!authUser)
        return redirect('/sign-in');

    const agencyId = await verifyAndAcceptInvitation();    
    const user = await getAuthUserDetails();
    console.log(agencyId, user);
    return (
        <div>
            Agency Dashboard
        </div>
    )
};
export default AgencyPage;