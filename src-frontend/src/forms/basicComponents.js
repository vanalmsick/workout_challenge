import React, {useEffect, useState} from "react";
import {
    Plus,
    Trash2,
    Save,
    CopyPlus,
    UsersRound,
    Flag,
    Settings,
    UserRoundPlus,
    RefreshCw,
    Pencil,
    ThumbsUp,
    ExternalLink,
    DoorOpen,
    Scale,
    UserRoundPen,
} from "lucide-react";
import {BeatLoader} from "react-spinners";
import { isMobile } from "react-device-detect";
import TimeField from "./customTimefieldInput";


export function Modal({setShowModal, title = null, landscape = false, isLoading = false, children}) {
    const backgroundClick = (e) => {
        if (e.target.classList.contains('modal-background')) {
            closeModal();
        }
    }

    const closeModal = () => {
        document.body.classList.remove('body-no-scroll');
        setShowModal(false);
    }

    useEffect(() => {
        document.body.classList.add('body-no-scroll');
    }, []);

    return (
        <div
            className="modal-background fixed inset-0 z-50 bg-white/80 dark:bg-black/80 overflow-y-auto sm:p-4"
            onClick={(e) => backgroundClick(e)}
        >
            <div className="modal-background min-h-screen flex items-center justify-center">
                <div
                    className={"relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 " + ((landscape) ? "max-w-4xl" : "max-w-2xl") +
                        " w-full space-y-4 max-sm:w-full max-sm:min-h-screen max-sm:rounded-none max-sm:p-4 max-sm:m-0 max-sm:shadow-none"}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold">{title}</h2>
                        <button className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                                onClick={() => closeModal()}
                        >
                            &times;
                        </button>
                    </div>

                    {
                        (isLoading) ? (
                                <div className="w-full h-64 flex items-center justify-center">
                                    <BeatLoader height={6} width={200} color="rgb(209 213 219)"/>
                                </div>
                            ) :
                            (
                                <>
                                    {children}
                                </>
                            )
                    }

                </div>
            </div>
        </div>
    )
}


export function FormInput({
                              name,
                              value = "",
                              setValue,
                              selectList = [],
                              suggestions = [],
                              label = null,
                              type = "text",
                              placeholder = null,
                              required = false,
                              readOnly = false,
                              disabled = false,
                              tabIndex = null,
                              autoFocus = false,
                              autoComplete = "off",
                              pattern = null,
                              width = "w-full",
                              highlight = false,
                              errorMsg = null,
                          }) {


    let additionalClasses = "";
    if (readOnly) {
        additionalClasses += " text-gray-500 dark:text-gray-500 " + ((highlight) ? "": " bg-gray-100 dark:bg-gray-700 ");
    }
    if (disabled) {
        additionalClasses += " text-gray-500 dark:text-gray-500 cursor-not-allowed " + ((highlight) ? "": " bg-gray-100 dark:bg-gray-700 ");
    }

    return (
        <div className={"px-4 " + width}>
            <fieldset>
                {/* Checkbox Input */}
                {
                    (type === "checkbox") ? (
                        <input
                            type="checkbox"
                            className="mr-2 leading-tight"
                            name={name}
                            tabIndex={tabIndex}
                            readOnly={readOnly}
                            disabled={disabled}
                            autoFocus={!isMobile && autoFocus}
                            checked={value}
                            onChange={(e) => setValue(!value)}
                        />
                    ) : null
                }

                {/* Input Label */}
                {(label) ? <label
                    className="w-full text-gray-700 dark:text-gray-400 text-sm font-bold mb-2 mr-4"
                    onClick={(type === "checkbox") ? (e) => setValue(!value): null}
                >{label}{(required) ? "*" : null}{(errorMsg) ?
                    <span className="text-red-600 font-normal italic"> ({errorMsg})</span> : null}</label> : null}

                {/* Input Element */}
                {
                    (type === "checkbox") ? (
                        <> {/* Checkbox Input Element has to go before the label */} </>
                    ) :
                    ((type === "time-cursor") || (!isMobile && type === "duration")) ? (
                        <TimeField
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            input={<input type="text" className={"w-full shadow-sm border rounded-sm py-2 px-3 text-gray-700 dark:bg-gray-900 dark:text-gray-400 leading-tight focus:outline-hidden focus:shadow-outline" + (highlight ? " bg-blue-100 dark:bg-blue-950 ": "") + additionalClasses} />}
                            showSeconds={true}
                        />
                    ) :
                    (type === "radio") ? (
                        <>
                            {/* Radio Select Input Element */}
                            {selectList.map((item, index) => (
                                <label key={index} className="inline-flex items-center mr-4 text-gray-700 text-sm">
                                    <input type="radio" className="form-radio text-gray-700"
                                           name={name}
                                           tabIndex={tabIndex}
                                           disabled={disabled}
                                           autoFocus={!isMobile && autoFocus}
                                           checked={(item.value === value) ? true : null}
                                           onChange={(e) => setValue(e.target.value)}
                                           value={item.value}
                                    />
                                    <span className="ml-2">{item.label}</span>
                                </label>
                            ))}
                        </>
                    ) :
                    (type === "select") ? (
                        <>
                            {/* Dropdown Input Element */}
                            <select
                                className={"w-full shadow-sm border rounded-sm py-2 px-3 text-gray-700 dark:bg-gray-800 dark:text-gray-400 leading-tight focus:outline-hidden focus:shadow-outline" + (highlight ? " bg-sky-50 dark:bg-sky-950 border border-blue-300 ": "") + additionalClasses}
                                name={name}
                                tabIndex={tabIndex}
                                required={required}
                                disabled={disabled}
                                autoFocus={!isMobile && autoFocus}
                                value={(value === null) ? '' : value}
                                onChange={(e) => setValue(e.target.value)}
                            >
                                {(placeholder !== false) && <option value="">{(placeholder) ? placeholder : "Select an option"}</option>}
                                {selectList.map((item, index) => (
                                    <option key={index} value={item.value}>{item.label}</option>
                                ))}
                            </select>
                        </>
                    ) :
                    (
                        <>
                            {/* All Other Input Elements */}
                            <input
                                className={"w-full shadow-sm border rounded-sm py-2 px-3 text-gray-700 dark:text-gray-400 dark:placeholder-gray-600 leading-tight focus:outline-hidden focus:shadow-outline" + (highlight ? " bg-sky-50 dark:bg-sky-950 border border-blue-300 ": " dark:bg-gray-900 ") + additionalClasses}
                                name={name}
                                type={(type === "duration") ? "time" : type}
                                placeholder={placeholder}
                                tabIndex={tabIndex}
                                required={required}
                                readOnly={readOnly}
                                disabled={disabled}
                                autoFocus={!isMobile && autoFocus}
                                autoComplete={autoComplete}
                                pattern={pattern}
                                value={(value === null) ? '' : value}
                                list={name + "-suggestions"}
                                onChange={(e) => setValue(e.target.value)}
                            />
                        </>
                    )
                }

                {/* Input User Suggestions */}
                {
                    (suggestions.length > 0) ? (
                        <datalist id={name + "-suggestions"}>
                            {suggestions.map((item, index) => (
                                <option key={index} value={item}/>
                            ))}
                        </datalist>
                    ) : null
                }

            </fieldset>
        </div>
    )
}


export function SingleForm({fields, values, setValues, errors = {}}) {

    const initialValues = Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, value.value])
    );

    return (
        <div className="flex flex-wrap">
            {Object.entries(fields).map(([fieldName, fieldKwargs]) => (
                <FormInput key={fieldName} {...fieldKwargs} value={values[fieldName]} errorMsg={errors[fieldName]}
                           setValue={(value) => setValues({...values, [fieldName]: value})}/>
            ))}
        </div>
    )
}


export function MultiForm({fields, values, setValues, errors = {}}) {

    //const [values, setValues] = useState([]);

    const addRow = () => {
        const initialValues = Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [key, value.value])
        );
        setValues([...values, {...initialValues}]);
    };

    const deleteRow = (index) => {
        const updated = values.filter((_, i) => i !== index);
        setValues(updated);
    };

    const handleChange = (index, field, value) => {
        const updated = [...values];
        updated[index][field] = value;
        setValues(updated);
    };

    useEffect(() => {
        if (values?.length === 0) {
            //addRow();
        }
    })

    return (
        <div>
            {values?.map((value_row, index) => (
                <div key={index} className="relative border border-gray-300 rounded-lg p-4 mb-4">
                    <button className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                            onClick={() => deleteRow(index)}
                    >
                        <Trash2 className="h-5 w-5"/>
                    </button>
                    <div className="flex flex-wrap">
                        {Object.entries(fields).map(([fieldName, fieldKwargs]) => (
                            <FormInput key={fieldName} {...fieldKwargs} value={value_row[fieldName]}
                                       errorMsg={errors?.[index]?.[fieldName]}
                                       setValue={(value) => handleChange(index, fieldName, value)}/>
                        ))}
                    </div>
                </div>
            ))}
            <div className="relative flex justify-center items-center">
                <AddButton additionalClasses=" hover:text-green-800 " onClick={addRow} highlighted={false} larger={false}/>
            </div>
        </div>
    )
}


function GenericButton({onClick, icon, label, highlighted, larger, IconObject, isLoading, additionalClasses}) {

    const [dots, setDots] = useState("");

    useEffect(() => {
        if (!isLoading) {
            setDots("");
            return;
        }

        const interval = setInterval(() => {
            setDots(prev => (prev.length < 3 ? prev + "." : ""));
        }, 300);

        return () => clearInterval(interval);
    }, [isLoading]);

    return (
        <button
            className={"flex items-center gap-2 transition hover:shadow-sm " + (larger ? (label ? " px-5 py-2.5 font-semibold rounded-full " : " px-3 py-3 rounded-2xl ") : (label ? " px-4 py-2 rounded-full " : " p-2 rounded-2xl ")) + (isLoading ? " bg-white hover:bg-white shadow-none border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-800 " : (highlighted ? " bg-sky-800 text-white  hover:bg-sky-700 " : " bg-gray-100 hover:bg-gray-300 dark:bg-gray-900 dark:hover:bg-gray-700 ")) + additionalClasses}
            onClick={onClick}
            disabled={isLoading}
        >
            {icon ? <IconObject className={(larger ? "h-4 w-4" : "h-3 w-3")}/> : null}
            {label ? <span className="text-sm">{label}{isLoading ? dots : null}</span> : null}
        </button>
    )
}


export function SaveButton({
                               onClick,
                               icon = true,
                               label = "Save",
                               highlighted = false,
                               larger = false,
                               isLoading = false,
                               additionalClasses = "",
                           }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Save} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function SaveAndAddButton({
                                     onClick,
                                     icon = true,
                                     label = "Save and add another",
                                     highlighted = false,
                                     larger = false,
                                     isLoading = false,
                                     additionalClasses = "",
                                 }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={CopyPlus} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function DeleteButton({
                                 onClick,
                                 icon = true,
                                 label = "Delete",
                                 highlighted = false,
                                 larger = false,
                                 isLoading = false,
                                 additionalClasses = "",
                             }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Trash2} isLoading={isLoading}
                          additionalClasses={" hover:text-red-800 " + additionalClasses}/>
}

export function AddButton({
                              onClick,
                              icon = true,
                              label = "Add",
                              highlighted = false,
                              larger = false,
                              isLoading = false,
                              additionalClasses = "",
                          }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Plus} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function EditButton({
                               onClick,
                               icon = true,
                               label = "Edit",
                               highlighted = false,
                               larger = false,
                               isLoading = false,
                               additionalClasses = "",
                           }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Pencil} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function ChangeOwnerButton({
                                      onClick,
                                      icon = true,
                                      label = "Transfer Ownership",
                                      highlighted = false,
                                      larger = false,
                                      isLoading = false,
                                      additionalClasses = "",
                                  }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={UserRoundPen} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function ChangeTeamButton({
                                     onClick,
                                     icon = true,
                                     label = "Change Team",
                                     highlighted = false,
                                     larger = false,
                                     isLoading = false,
                                     additionalClasses = "",
                                 }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={UsersRound} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function JoinButton({
                               onClick,
                               icon = true,
                               label = "Join",
                               highlighted = false,
                               larger = false,
                               isLoading = false,
                               additionalClasses = "",
                           }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={UserRoundPlus} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function LeaveButton({
                                onClick,
                                icon = true,
                                label = "Leave Competition",
                                highlighted = false,
                                larger = false,
                                isLoading = false,
                                additionalClasses = "",
                            }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={DoorOpen} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function ShareButton({
                                onClick,
                                icon = true,
                                label = "Invite Others",
                                highlighted = false,
                                larger = false,
                                isLoading = false,
                                additionalClasses = "",
                            }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={ExternalLink} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function ModifyGoalsButton({
                                      onClick,
                                      icon = true,
                                      label = "Modify Goals",
                                      highlighted = false,
                                      larger = false,
                                      isLoading = false,
                                      additionalClasses = "",
                                  }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Flag} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function FairGoalsButton({
                                    onClick,
                                    icon = true,
                                    label = "Goal Equalizer",
                                    highlighted = false,
                                    larger = false,
                                    isLoading = false,
                                    additionalClasses = "",
                                }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Scale} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function SettingsButton({
                                   onClick,
                                   icon = true,
                                   label = "Settings",
                                   highlighted = false,
                                   larger = false,
                                   isLoading = false,
                                   additionalClasses = "",
                               }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={Settings} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function RefreshButton({
                                  onClick,
                                  icon = true,
                                  label = "Refresh",
                                  highlighted = false,
                                  larger = false,
                                  isLoading = false,
                                  additionalClasses = "",
                              }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={RefreshCw} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function SyncStravaButton({
                                     onClick,
                                     icon = true,
                                     label = "Re-Sync with Strava",
                                     highlighted = false,
                                     larger = false,
                                     isLoading = false,
                                     additionalClasses = "",
                                 }) {
    return <GenericButton onClick={onClick} icon={icon} label={label} highlighted={highlighted} larger={larger}
                          IconObject={RefreshCw} isLoading={isLoading} additionalClasses={additionalClasses}/>
}

export function StravaButton({onClick, additionalClasses = "", label = "Strava"}) {
    return (
        <button
            className={"flex items-center gap-1 text-orange-500 border border-strava bg-white dark:bg-gray-900 hover:bg-strava hover:text-white hover:shadow-sm text-sm font-medium rounded-md transition p-0 " + additionalClasses}
            onClick={onClick}>
            <img src="/strava_logo.png" alt="Strava" className="w-7 h-7 rounded-tl-sm rounded-bl-sm"/>
            <span className={"pl-1 pr-2 py-1 " + ((label.includes("Like") || label.includes("Follow")) ? "max-lg:hidden" : "")}>{label}</span>
            {
                (label.includes("Like") || label.includes("Follow")) ? (
                    <span className="max-sm:hidden lg:hidden pl-1 pr-2 py-1">
                    {
                        (label.includes("Like")) ? (
                            <ThumbsUp className="h-4 w-4"/>
                        ) : (
                            <UserRoundPlus className="h-4 w-4"/>
                        )
                    }
                </span>
                ) : null
            }
        </button>
    )
}