import {useGetCompetitionsQuery} from "./reducers/competitionsSlice";
import {Link} from "react-router";
import React, {useEffect, useMemo, useRef, useState} from "react";
import CompetitionForm from "../forms/competitionForm";
import {LogOut, BadgeHelp, ChevronDown} from "lucide-react";
import SupportModal from "../forms/supportModal";

// A competition counts as "past" once it ended more than one month ago
const pastCutoffDate = () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
};

const parseEndDate = (competition) => {
    if (!competition?.end_date) return null;
    const parsed = new Date(competition.end_date);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export default function NavMenu({page}) {
    const [showEditCompetitionModal, setShowEditCompetitionModal] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showPastMenu, setShowPastMenu] = useState(false);
    const [pastMenuPos, setPastMenuPos] = useState({top: 0, left: 0});

    const pastButtonRef = useRef(null);
    const pastMenuRef = useRef(null);

    const {
        data: competitions,
        error: competitionError,
        isLoading: competitionLoading,
        isSuccess: competitionIsSuccess
    } = useGetCompetitionsQuery();

    // Split competitions into current and past. The currently opened competition
    // is always shown in the main section, even if it is a past one.
    const {currentCompetitions, pastCompetitions} = useMemo(() => {
        if (!competitionIsSuccess || !competitions) return {currentCompetitions: [], pastCompetitions: []};

        const cutoff = pastCutoffDate();
        const current = [];
        const past = [];

        Object.entries(competitions).forEach(([_, competition]) => {
            const endDate = parseEndDate(competition);
            const isPast = endDate !== null && endDate < cutoff;
            const isOpen = page === `${competition.id}`;
            if (isPast && !isOpen) {
                past.push(competition);
            } else {
                current.push(competition);
            }
        });

        // Most recently finished past competition first
        past.sort((a, b) => (parseEndDate(b)?.getTime() ?? 0) - (parseEndDate(a)?.getTime() ?? 0));

        return {currentCompetitions: current, pastCompetitions: past};
    }, [competitions, competitionIsSuccess, page]);

    // Close the "Past" dropdown again as soon as another competition is selected
    useEffect(() => {
        setShowPastMenu(false);
    }, [page]);

    // The nav bar scrolls horizontally (overflow-x-auto) which would clip an
    // absolutely positioned dropdown - so position it fixed relative to the button.
    useEffect(() => {
        if (!showPastMenu) return;

        const updatePosition = () => {
            const rect = pastButtonRef.current?.getBoundingClientRect();
            if (rect) setPastMenuPos({top: rect.bottom + 8, left: rect.left});
        };
        const handleClickOutside = (event) => {
            if (pastMenuRef.current?.contains(event.target)) return;
            if (pastButtonRef.current?.contains(event.target)) return;
            setShowPastMenu(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setShowPastMenu(false);
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showPastMenu]);

    const linkClasses = (isActive) => "px-4 py-2 rounded-full transition-colors " +
        (isActive ? "bg-sky-800 text-white" : "hover:text-light-blue dark:text-white");

    return (
        <>
            <div className="overflow-x-auto mx-2">
                <div className="flex items-center justify-between">
                    <div className="mr-auto"></div>

                    <div className="bg-white dark:bg-gray-700 rounded-full shadow-xs w-max mx-auto">
                        <nav className="flex space-x-1 sm:space-x-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                            <Link to='/dashboard'
                                  className={linkClasses(page === 'my')}>My
                                Space
                            </Link>
                            {currentCompetitions.map((competition) => (
                                <Link key={"key" + competition.id} to={`/competition/${competition.id}`}
                                      className={linkClasses(page === `${competition.id}`)}>
                                    {competition.name}
                                </Link>
                            ))}
                            {(pastCompetitions.length > 0) && (
                                <button type="button"
                                        ref={pastButtonRef}
                                        aria-haspopup="menu"
                                        aria-expanded={showPastMenu}
                                        onClick={() => setShowPastMenu((open) => !open)}
                                        className={"flex items-center gap-1 " + linkClasses(false)}>
                                    Past
                                    <ChevronDown
                                        className={"w-4 h-4 transition-transform " + (showPastMenu ? "rotate-180" : "")}/>
                                </button>
                            )}
                            <div onClick={() => setShowEditCompetitionModal(true)}
                                 className="px-4 py-2 rounded-full transition-colors hover:text-light-blue dark:text-white cursor-pointer">+
                                Create Competition
                            </div>
                        </nav>
                    </div>
                    <div className="flex pl-2 space-x-2 ml-auto">
                        <Link to={'/logout'} className="bg-white dark:bg-gray-700 rounded-full shadow-xs w-max p-2">
                            <LogOut className="w-5 h-5"/>
                        </Link>
                        <button onClick={() => setShowSupportModal(true)} className="bg-white dark:bg-gray-700 rounded-full shadow-xs w-max p-2">
                            <BadgeHelp className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </div>
            {(showPastMenu && pastCompetitions.length > 0) && (
                <div ref={pastMenuRef}
                     role="menu"
                     style={{top: pastMenuPos.top, left: pastMenuPos.left}}
                     className="fixed z-50 min-w-40 max-h-72 overflow-y-auto py-1 bg-white dark:bg-gray-700 rounded-xl shadow-lg text-sm font-medium text-gray-600">
                    {pastCompetitions.map((competition) => (
                        <Link key={"past" + competition.id}
                              to={`/competition/${competition.id}`}
                              role="menuitem"
                              onClick={() => setShowPastMenu(false)}
                              className="block px-3 py-1 leading-tight transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-light-blue dark:text-white">
                            <span className="block">{competition.name}</span>
                            {competition.end_date_fmt && (
                                <span className="block text-xs text-gray-400 dark:text-gray-300">
                                    ended {competition.end_date_fmt}
                                </span>
                            )}
                        </Link>
                    ))}
                </div>
            )}
            {(showEditCompetitionModal) && <CompetitionForm setModalState={setShowEditCompetitionModal} id={showEditCompetitionModal}/>}
            {(showSupportModal) && <SupportModal setModalState={setShowSupportModal}/>}
        </>
    );
}
