import { GitBranch } from "lucide-react";
import { Create, DataTable, Edit, List, SimpleForm, BooleanInput, NumberInput, TextInput } from "@/components/admin";
import { ResourceProps, required } from "ra-core";
import { OwsEditorInput } from "@/components/workflow/ows-editor";

export const WorkflowCreate = () => (
    <Create redirect="list">
        <SimpleForm>
            <TextInput source="name" label="Name" validate={required()} />
            <BooleanInput source="active" />
            <TextInput source="description" label="Description" />
            <NumberInput source="version" />
            <OwsEditorInput source="definition_json" label="OWS definition" validate={required()} />
        </SimpleForm>
    </Create>
);

export const WorkflowEdit = () => (
    <Edit>
        <div className="flex flex-col lg:flex-row items-start justify-between">
            <SimpleForm>
                <BooleanInput source="active" />
                <TextInput source="description" />
                <TextInput source="name" />
                <NumberInput source="version" />
                <OwsEditorInput source="definition_json" label="OWS definition" validate={required()} />
            </SimpleForm>
        </div>
    </Edit>
);

export const WorkflowList = () => (
    <List perPage={50}>
        <DataTable>
            <DataTable.Col source="active" />
            <DataTable.Col source="name" />
            <DataTable.Col source="version" />
            <DataTable.Col source="description" />
        </DataTable>
    </List>
);

export const Workflows: ResourceProps = {
    name: "workflows",
    list: WorkflowList,
    edit: WorkflowEdit,
    create: WorkflowCreate,
    recordRepresentation: "name",
    icon: GitBranch,
};

export default Workflows;
