import {useGetCompetitionsQuery} from "./reducers/competitionsSlice";
import {Link} from "react-router";
import React, {useState} from "react";
import CompetitionForm from "../forms/competitionForm";
import {LogOut, BadgeHelp} from "lucide-react";
import SupportModal from "../forms/supportModal";

export default function NavMenu({page}) {
    const [showEditCompetitionModal, setShowEditCompetitionModal] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);

    const {
        data: competitions,
        error: competitionError,
        isLoading: competitionLoading,
        isSuccess: competitionIsSuccess
    } = useGetCompetitionsQuery();

    return (
        <>
            <div className="overflow-x-auto mx-2">
                <div className="flex items-center justify-between">
                    <div className="mr-auto"></div>

                    <div className="bg-white dark:bg-gray-700 rounded-full shadow-sm w-max mx-auto">
                        <nav className="flex space-x-1 sm:space-x-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                            <Link to='/dashboard'
                                  className={"px-4 py-2 rounded-full transition-colors " + ((page === 'my' ? "bg-sky-800 text-white" : "hover:text-light-blue dark:text-white"))}>My
                                Space
                            </Link>
                            {(competitionIsSuccess) ? Object.entries(competitions).map(([_, competition], i) => (
                                <Link key={"key" + competition.id} to={`/competition/${competition.id}`}
                                      className={"px-4 py-2 rounded-full transition-colors " + ((page === `${competition.id}` ? "bg-sky-800 text-white" : "hover:text-light-blue dark:text-white"))}>
                                    {competition.name}
                                </Link>
                            )) : null}
                            <div onClick={() => setShowEditCompetitionModal(true)}
                                 className="px-4 py-2 rounded-full transition-colors hover:text-light-blue dark:text-white cursor-pointer">+
                                Create Competition
                            </div>
                        </nav>
                    </div>
                    <div className="flex pl-2 space-x-2 ml-auto">
                        <Link to={'/logout'} className="bg-white dark:bg-gray-700 rounded-full shadow-sm w-max p-2">
                            <LogOut className="w-5 h-5"/>
                        </Link>
                        <button onClick={() => setShowSupportModal(true)} className="bg-white dark:bg-gray-700 rounded-full shadow-sm w-max p-2">
                            <BadgeHelp className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </div>
                {(showEditCompetitionModal) && <CompetitionForm setModalState={setShowEditCompetitionModal} id={showEditCompetitionModal}/>}
                {(showSupportModal) && <SupportModal setModalState={setShowSupportModal}/>}
            </>
            );
            }