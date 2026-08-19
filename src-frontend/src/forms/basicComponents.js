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


/* =========================================================================
 * Shared form-control styling
 * -------------------------------------------------------------------------
 * Single source of truth for how every input in the app looks. Import
 * `inputClasses`, `labelClasses` & friends instead of hand-writing Tailwind
 * on an <input>/<select> somewhere, so all fields stay in sync.
 * ========================================================================= */

// Label above a field
export const labelClasses = "block mb-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300";

// Error message underneath a field
export const errorClasses = "mt-1 block text-xs italic text-red-600 dark:text-red-400";

// Small print / helper text underneath a field
export const helpTextClasses = "mt-1 block text-xs italic text-gray-500 dark:text-gray-400";

// Geometry + typography shared by <input>, <select> and the duration field
const CONTROL_BASE =
    "block w-full rounded-lg border px-3 py-2 text-sm leading-6 shadow-sm " +
    "transition-colors duration-150 focus:outline-hidden focus:ring-2";

const CONTROL_DEFAULT =
    "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 hover:border-gray-400 " +
    "focus:border-sky-600 focus:ring-sky-600/30 " +
    "dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500 " +
    "dark:hover:border-gray-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/30";

// Fields the user should notice (e.g. the calculated equalizer factors)
const CONTROL_HIGHLIGHT =
    "border-sky-300 bg-sky-50 text-sky-900 placeholder:text-sky-400 hover:border-sky-400 " +
    "focus:border-sky-600 focus:ring-sky-600/30 " +
    "dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100 dark:placeholder:text-sky-700 " +
    "dark:hover:border-sky-600 dark:focus:border-sky-400 dark:focus:ring-sky-400/30";

const CONTROL_ERROR =
    "border-red-400 bg-red-50 text-gray-900 placeholder:text-red-300 hover:border-red-500 " +
    "focus:border-red-500 focus:ring-red-500/30 " +
    "dark:border-red-500 dark:bg-red-950/40 dark:text-gray-100 dark:placeholder:text-red-800 " +
    "dark:focus:border-red-400 dark:focus:ring-red-400/30";

// Read-only / disabled
const CONTROL_MUTED =
    "border-gray-200 bg-gray-100 text-gray-500 placeholder:text-gray-400 " +
    "focus:border-gray-300 focus:ring-gray-300/30 " +
    "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:placeholder:text-gray-600";

/**
 * Build the class list for a text input / select / textarea.
 * Use this everywhere instead of repeating Tailwind class strings.
 */
export function inputClasses({
                                 highlight = false,
                                 error = false,
                                 readOnly = false,
                                 disabled = false,
                                 extra = "",
                             } = {}) {
    let state;
    if (error) {
        state = CONTROL_ERROR;
    } else if (highlight) {
        // highlighted fields keep their colour even when read-only/disabled
        state = CONTROL_HIGHLIGHT;
    } else if (disabled || readOnly) {
        state = CONTROL_MUTED;
    } else {
        state = CONTROL_DEFAULT;
    }
    const cursor = disabled ? " cursor-not-allowed" : (readOnly ? " cursor-default" : "");
    return `${CONTROL_BASE} ${state}${cursor}${extra ? " " + extra : ""}`;
}

// Checkbox / radio boxes
export const checkboxClasses =
    "h-4 w-4 shrink-0 rounded-sm border-gray-300 accent-sky-800 " +
    "focus:outline-hidden focus:ring-2 focus:ring-sky-600/30 " +
    "disabled:cursor-not-allowed disabled:opacity-60 " +
    "dark:border-gray-600 dark:accent-sky-500";

export const radioClasses = checkboxClasses.replace("rounded-sm", "rounded-full");


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
                              read_only = false,          // field definitions use the snake_case key
                              disabled = false,
                              tabIndex = null,
                              autoFocus = false,
                              autoComplete = "off",
                              pattern = null,
                              width = "w-full",
                              highlight = false,
                              errorMsg = null,
                              decimal_places = 2,
                          }) {

    const isReadOnly = readOnly || read_only;
    const hasError = errorMsg !== null && errorMsg !== undefined && errorMsg !== "" &&
        !(Array.isArray(errorMsg) && errorMsg.length === 0);

    // stable id so the <label> actually focuses its field when clicked
    const fieldId = "field-" + String(name || label || type).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const errorId = fieldId + "-error";
    const listId = fieldId + "-suggestions";

    const classes = inputClasses({highlight, error: hasError, readOnly: isReadOnly, disabled});

    const errorNode = hasError ? (
        <span id={errorId} role="alert" className={errorClasses}>
            {Array.isArray(errorMsg) ? errorMsg.join(" ") : errorMsg}
        </span>
    ) : null;

    const labelNode = label ? (
        <label htmlFor={fieldId} className={labelClasses}>
            {label}{required ? <span className="text-red-500"> *</span> : null}
        </label>
    ) : null;

    /* ---------------------------------------------------------------- */
    /* Checkbox – box and text on one clickable row                      */
    /* ---------------------------------------------------------------- */
    if (type === "checkbox") {
        return (
            <div className={"px-4 py-2 " + width}>
                <label
                    htmlFor={fieldId}
                    className={"flex items-start gap-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 " +
                        (disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer select-none")}
                >
                    <input
                        id={fieldId}
                        type="checkbox"
                        className={checkboxClasses + " mt-1"}
                        name={name}
                        tabIndex={tabIndex}
                        disabled={disabled || isReadOnly}
                        autoFocus={!isMobile && autoFocus}
                        checked={Boolean(value)}
                        aria-invalid={hasError || undefined}
                        aria-describedby={hasError ? errorId : undefined}
                        onChange={() => setValue(!value)}
                    />
                    <span>{label}{required ? <span className="text-red-500"> *</span> : null}</span>
                </label>
                {errorNode}
            </div>
        )
    }

    /* ---------------------------------------------------------------- */
    /* Radio group                                                       */
    /* ---------------------------------------------------------------- */
    if (type === "radio") {
        return (
            <div className={"px-4 py-2 " + width}>
                {labelNode}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-0.5">
                    {selectList.map((item, index) => (
                        <label key={index}
                               className={"inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 " +
                                   (disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer select-none")}>
                            <input
                                type="radio"
                                className={radioClasses}
                                name={name || fieldId}
                                tabIndex={tabIndex}
                                disabled={disabled || isReadOnly}
                                autoFocus={!isMobile && autoFocus && index === 0}
                                checked={item.value === value}
                                onChange={(e) => setValue(e.target.value)}
                                value={item.value}
                            />
                            <span>{item.label}</span>
                        </label>
                    ))}
                </div>
                {errorNode}
            </div>
        )
    }

    /* ---------------------------------------------------------------- */
    /* Duration (desktop uses the cursor-aware time field)               */
    /* ---------------------------------------------------------------- */
    if (type === "time-cursor" || (!isMobile && type === "duration")) {
        return (
            <div className={"px-4 py-2 " + width}>
                {labelNode}
                <TimeField
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    input={<input
                        id={fieldId}
                        type="text"
                        inputMode="numeric"
                        className={classes}
                        name={name}
                        tabIndex={tabIndex}
                        disabled={disabled}
                        readOnly={isReadOnly}
                        autoFocus={!isMobile && autoFocus}
                        aria-invalid={hasError || undefined}
                        aria-describedby={hasError ? errorId : undefined}
                    />}
                    showSeconds={true}
                />
                {errorNode}
            </div>
        )
    }

    /* ---------------------------------------------------------------- */
    /* Select                                                            */
    /* ---------------------------------------------------------------- */
    if (type === "select") {
        return (
            <div className={"px-4 py-2 " + width}>
                {labelNode}
                <select
                    id={fieldId}
                    // extra right padding leaves room for the native dropdown arrow
                    className={classes + " pr-8"}
                    name={name}
                    tabIndex={tabIndex}
                    required={required}
                    disabled={disabled || isReadOnly}
                    autoFocus={!isMobile && autoFocus}
                    value={(value === null || value === undefined) ? '' : value}
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? errorId : undefined}
                    onChange={(e) => setValue(e.target.value)}
                >
                    {(placeholder !== false) &&
                        <option value="">{placeholder ? placeholder : "Select an option"}</option>}
                    {selectList.map((item, index) => (
                        <option key={index} value={item.value}>{item.label}</option>
                    ))}
                </select>
                {errorNode}
            </div>
        )
    }

    /* ---------------------------------------------------------------- */
    /* Everything else: text, email, number, decimal, date, datetime …   */
    /* ---------------------------------------------------------------- */
    const htmlType = (type === "duration") ? "time" : (type === "decimal") ? "number" : type;
    const step = (type === "decimal") ? String(1 / Math.pow(10, decimal_places)) : undefined;

    return (
        <div className={"px-4 py-2 " + width}>
            {labelNode}
            <input
                id={fieldId}
                className={classes}
                name={name}
                type={htmlType}
                step={step}
                inputMode={(type === "decimal") ? "decimal" : undefined}
                placeholder={(placeholder === false) ? undefined : placeholder}
                tabIndex={tabIndex}
                required={required}
                readOnly={isReadOnly}
                disabled={disabled}
                autoFocus={!isMobile && autoFocus}
                autoComplete={autoComplete}
                pattern={pattern}
                value={(value === null || value === undefined) ? '' : value}
                list={(suggestions.length > 0) ? listId : undefined}
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? errorId : undefined}
                onChange={(e) => setValue(e.target.value)}
            />
            {errorNode}

            {/* Input User Suggestions */}
            {(suggestions.length > 0) ? (
                <datalist id={listId}>
                    {suggestions.map((item, index) => (
                        <option key={index} value={item}/>
                    ))}
                </datalist>
            ) : null}
        </div>
    )
}


export function SingleForm({fields, values, setValues, errors = {}}) {

    return (
        <div className="flex flex-wrap">
            {Object.entries(fields).map(([fieldName, fieldKwargs]) => (
                <FormInput key={fieldName} name={fieldName} {...fieldKwargs} value={values[fieldName]}
                           errorMsg={errors?.[fieldName]}
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
                <div key={index}
                     className="relative border border-gray-200 dark:border-gray-700 rounded-xl p-4 pt-6 mb-4">
                    <button className="absolute top-2 right-2 text-gray-500 hover:text-red-500 transition-colors"
                            onClick={() => deleteRow(index)}
                    >
                        <Trash2 className="h-5 w-5"/>
                    </button>
                    <div className="flex flex-wrap">
                        {Object.entries(fields).map(([fieldName, fieldKwargs]) => (
                            <FormInput key={fieldName} name={fieldName + "-" + index} {...fieldKwargs}
                                       value={value_row[fieldName]}
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