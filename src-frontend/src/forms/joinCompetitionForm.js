import React, {useEffect, useState} from "react";
import {useJoinCompetitionMutation} from "../utils/reducers/joinSlice";
import {useNavigate} from "react-router";
import {JoinButton, Modal, SingleForm} from "./basicComponents";
import {competitionsApi} from "../utils/reducers/competitionsSlice";
import {usersApi} from "../utils/reducers/usersSlice";
import {useDispatch} from "react-redux";


const fields = {

    "join_code": {
        "type": "text",
        "required": true,
        "read_only": false,
        "label": "Competition Join Code",
        "width": "max-sm:w-full w-2/3",
        "autoFocus": true,
    },

}


export default function JoinCompetitionForm({setModalState, join_code= null}) {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [values, setValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [formError, setFormError] = useState('');

    const [updateEntry, {
        data: updateData,
        error: updateError,
        isLoading: updateIsLoading,
        isSuccess: updateIsSuccess
    }] = useJoinCompetitionMutation();

    // Overall form error message
    useEffect(() => {
        if (updateError !== undefined) {
            setFormError('Error (' + updateError?.status?.toLocaleString() + ' ' + updateError?.originalStatus?.toLocaleString() + '): ' + updateError?.data?.message);
        }
    }, [updateError])

    // load current form values
    useEffect(() => {
        if (join_code !== undefined && join_code !== null) {
            setValues({join_code: join_code});
            joinCompetition(join_code, false);
        }
    }, [])

    // form action button right
    async function handleSubmit() {
        joinCompetition(values.join_code, join_code === null);
    }

    // function to join competition
    async function joinCompetition(joinCode, redirect = true) {
        try {
            const result = await updateEntry(joinCode).unwrap();
            console.log('Join Competition success:', result);
            setModalState(false);
            document.body.classList.remove('body-no-scroll');
            if (redirect) {
                navigate('/competition/' + result.competition);
            }
            dispatch(competitionsApi.util.invalidateTags(['Competition']));
            dispatch(usersApi.util.invalidateTags(['User']));
        } catch (err) {
            console.error('Join Competition failed', err);
            setFieldErrors(err.data);
            setFormError(err.message);
        }
    }

    return (
        <Modal title="Join Competition" landscape={false} setShowModal={setModalState} isLoading={updateIsLoading}>
            <SingleForm fields={fields} values={values} setValues={setValues} errors={fieldErrors}/>
            <div className="text-center text-red-500 text-xs italic">{formError}</div>
            <div className="relative flex justify-end items-end">
              <JoinButton onClick={handleSubmit} label="Join Competition" highlighted={true} larger={true} />
            </div>
        </Modal>
    )
}