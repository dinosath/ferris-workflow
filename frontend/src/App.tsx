import { Admin } from "@/components/admin";
import { NotFoundPage } from "@/pages/not-found-page";
import { ServerErrorPage } from "@/pages/server-error-page";
import { dataProvider } from '@/lib/dataProvider';
import {Resource} from "ra-core";


import workflow from "./resources/workflow"


function App() {
    return (
        <Admin
            catchAll={NotFoundPage}
            error={ServerErrorPage}
            dataProvider={dataProvider}
            >
            <Resource { ...workflow }/>
            
        </Admin>
    );
}
export default App;