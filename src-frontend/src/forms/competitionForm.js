import React, {useEffect, useState} from "react";
import {
    useAddCompetitionMutation,
    useDeleteCompetitionMutation,
    useUpdateCompetitionMutation
} from "../utils/reducers/competitionsSlice";
import {useNavigate} from "react-router";
import {ChangeOwnerButton, DeleteButton, Modal, SaveButton, SingleForm} from "./basicComponents";


const fields = {

    "name": {
        "type": "text",
        "required": true,
        "read_only": false,
        "label": "Competition Name",
        "width": "max-sm:w-full w-1/2",
        "autoFocus": true,
    },

    "start_date": {
        "type": "date",
        "required": true,
        "read_only": false,
        "label": "Start Date",
        "width": "max-sm:w-1/2 w-1/4",
    },

    "end_date": {
        "type": "date",
        "required": true,
        "read_only": false,
        "label": "End Date",
        "width": "max-sm:w-1/2 w-1/4",
    },

    "has_teams": {
        "type": "checkbox",
        "required": false,
        "read_only": false,
        "label": "Users can compete in teams",
    },

    "organizer_assigns_teams": {
        "type": "checkbox",
        "required": false,
        "read_only": false,
        "label": "Only organizer can assign teams",
    },

}


export default function CompetitionForm({competition, setModalState, setShowTransferCompetitionModal}) {
    const navigate = useNavigate();

    const [values, setValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [formError, setFormError] = useState('');

    const [updateEntry, {
        data: updateData,
        error: updateError,
        isLoading: updateIsLoading,
        isSuccess: updateIsSuccess
    }] = useUpdateCompetitionMutation();
    const [createEntry, {
        data: createData,
        error: createError,
        isLoading: createIsLoading,
        isSuccess: createIsSuccess
    }] = useAddCompetitionMutation();
    const [deleteEntry, {
        error: deleteError,
        isLoading: deleteIsLoading,
        isSuccess: deleteIsSuccess
    }] = useDeleteCompetitionMutation();

    // Overall form error message
    useEffect(() => {
        if (updateError !== undefined) {
            setFormError('Update Error (' + updateError?.status?.toLocaleString() + ' ' + updateError?.originalStatus?.toLocaleString() + '): ' + updateError?.message);
        } else if (createError !== undefined) {
            setFormError('Create Error (' + createError?.status?.toLocaleString() + ' ' + createError?.originalStatus?.toLocaleString()  + '): ' + createError?.message);
        } else if (deleteError !== undefined) {
            setFormError('Delete Error (' + deleteError?.status?.toLocaleString() + ' ' + deleteError?.originalStatus?.toLocaleString()  + '): ' + deleteError?.message);
        }
    }, [updateError, createError, deleteError])

    // load current form values
    useEffect(() => {
        if (competition !== undefined) {
            setValues(competition);
        }
    }, [])
    
    // conditionally show/hide organizer_assigns_teams 
    const finalFields = {...fields};
    if (!values.has_teams) {
        delete finalFields.organizer_assigns_teams;
    }

    // form action button left
    async function handleDiscard() {
        if (competition !== undefined) {
            // delete competition
            try {
                const confirmation = window.confirm('You are deleting this competition. This is irreversible. Are you sure?');
                if (confirmation) {
                    const result = await deleteEntry(values.id).unwrap();
                    console.log('Delete Competition success:', result);
                    setModalState(false);
                    document.body.classList.remove('body-no-scroll');
                    navigate('/dashboard/');
                }
            } catch (err) {
                console.error('Delete Competition failed', err);
            }
        } else {
            // discard competition
            setValues({});
            setModalState(false);
            document.body.classList.remove('body-no-scroll');
        }
    }

    // form action button right
    async function handleSubmit() {
        if (competition !== undefined) {
            // update competition
            try {
                const result = await updateEntry(values).unwrap();
                console.log('Update Competition success:', result);
                setModalState(false);
                document.body.classList.remove('body-no-scroll');
                window.alert('Saved. Changes might take up to 10 minutes to reflect on the competition page for all users.');
            } catch (err) {
                console.error('Update Competition failed', err);
                setFieldErrors(err.data);
            }
        } else {
            // create competition
            try {
                const result = await createEntry(values).unwrap();
                console.log('Create Competition success:', result);
                setModalState(false);
                document.body.classList.remove('body-no-scroll');
                navigate(`/competition/${result.id}`);
            } catch (err) {
                console.error('Create Competition failed', err);
                setFieldErrors(err.data);
            }
        }
    }

    return (
        <Modal title="Competition" landscape={true} setShowModal={setModalState} isLoading={updateIsLoading || createIsLoading || deleteIsLoading}>
            <SingleForm fields={finalFields} values={values} setValues={setValues} errors={fieldErrors}/>
            <div className="text-center text-red-500 text-xs italic">{formError}</div>
            <div className="relative flex justify-between items-center">
                <DeleteButton onClick={handleDiscard} label={(competition !== undefined) ? "Delete" : "Discard"} highlighted={false} larger={true} />
                {(competition !== undefined) && <ChangeOwnerButton onClick={() => {setModalState(false); setShowTransferCompetitionModal(true);}} label={"Transfer Ownership"} highlighted={false} larger={true} />}
                <SaveButton onClick={handleSubmit} label={(competition !== undefined) ? "Update" : "Create"} highlighted={true} larger={true} />
            </div>
        </Modal>
    )
}