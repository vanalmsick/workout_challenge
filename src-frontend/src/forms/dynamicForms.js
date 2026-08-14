import '../utils/Modals.css';
import React, {useEffect, useState} from "react";
import {Link} from "react-router";
import WorkoutForm from "./workoutForm";


function validateForm({actionData, fields}) {
    let valid = true;
    let errors = {};
    let error_lst = [];
    Object.entries(fields).forEach(([key, prop]) => {
        if (prop.required && !actionData[key]) {
            valid = false;
            errors[key] = 'This field is required.';
            error_lst.push(key + ': ' + errors[key]);
        }
    });
    const error_msg = error_lst.join(', ');
    return {valid, errors, error_msg};
}



export default function DynamicForm({setModalState, fields, setAction, actionData, setActionData, secondaryAction, errors, setErrors, children}) {

    const handleChange = (e, field) => {
        setActionData({
            ...actionData,
            [field]: e.target.value
        });
        //console.log(field, e.target.value);
    };

    const handleSubmit = (e, button) => {
        e.preventDefault();
        const {valid, errors, error_msg} = validateForm({actionData, fields});
        setErrors(error_msg);
        if (valid) {
            if (button === 'SAVE') {
                setAction('SAVE');
            } else if (button === 'ADD') {
                setAction('ADD');
            } else if ('DELETE') {
                setAction('DELETE');
            }
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl px-8 pt-6 pb-8 mb-4 ">
                <div className="flex flex-wrap">
                    {Object.entries(fields).map(([key, prop], i) => (
                        <div className={"px-4 py-2 modal_" + key} key={key}>
                            <label className="w-full block text-gray-700 text-sm font-bold mb-2">
                                {prop.label}{(prop.required) ? ("*") : (null)}
                            </label>
                            {(prop.type === "choice") ? (
                                <select className="w-full shadow-sm appearance-none border rounded-sm py-2 px-3 text-gray-700 leading-tight focus:outline-hidden focus:shadow-outline"
                                        name={key}
                                        value={actionData[key] || ''}
                                        tabIndex={i}
                                        required={prop.required}
                                        autoFocus={i===0}
                                        onChange={(e) => handleChange(e, key)}>
                                    {prop.choices.map((choice, i) => (
                                        <option key={i} value={choice.value}>{choice.display_name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={prop.type}
                                    name={key}
                                    id={key}
                                    className={((prop.type === "checkbox") ? "h-5 w-5 text-blue-600 border-gray-300 rounded-sm focus:ring-blue-500" : "w-full shadow-sm appearance-none border rounded-sm py-2 px-3 text-gray-700 leading-tight focus:outline-hidden focus:shadow-outline") + ((prop.read_only) ? " bg-gray-100 text-gray-500" : "")}
                                    required={prop.required}
                                    readOnly={prop.read_only}
                                    placeholder={null}
                                    autoFocus={i===0}
                                    tabIndex={i}
                                    onChange={(e) => handleChange(e, key)}
                                    value={actionData[key] || ''}
                                    checked={prop.type === "checkbox" && actionData[key]}
                                />
                            )}

                        </div>
                    ))}
                </div>

                <div className="flex flex-row-reverse items-center justify-between mt-3.5">
                    <button type="submit"
                            onClick={(e) => handleSubmit(e, 'SAVE')}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 mx-4 px-5 rounded-sm focus:outline-hidden focus:shadow-outline">
                        Save
                    </button>
                    {(secondaryAction === 'ADD') ? (
                        <button onClick={(e) => handleSubmit(e, 'ADD')}
                                className="text-blue-500 hover:bg-blue-500 hover:text-white bg-white font-bold border border-blue-500 py-2 mx-4 px-5 rounded-sm focus:outline-hidden focus:shadow-outline">
                            Save and add another
                        </button>
                    ) : (secondaryAction === 'DELETE') ? (
                        <button onClick={(e) => handleSubmit(e, 'DELETE')}
                                className="text-blue-500 hover:bg-blue-500 hover:text-white bg-white font-bold border border-blue-500 py-2 mx-4 px-5 rounded-sm focus:outline-hidden focus:shadow-outline">
                            Delete
                        </button>
                    ) : null}

                </div>
                <p id="errors" className="text-red-500 text-xs italic mt-5">{errors}</p>
                {children}
            </form>
        </div>
    );
}

