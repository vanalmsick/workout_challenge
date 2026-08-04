import {useNavigate, useNavigationType, useParams} from 'react-router';
import React, {useEffect, useState} from "react";
import NavMenu from "../utils/navMenu";
import {competitionsApi, useGetCompetitionByIdQuery} from "../utils/reducers/competitionsSlice";
import {
    ArrowDownToLine,
    ArrowUpToLine,
    UsersRound,
} from "lucide-react";
import {Bar, Line} from 'react-chartjs-2';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    LineElement,
    PointElement,
    Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {statsApi, useGetStatsByIdQuery} from "../utils/reducers/statsSlice";
import {useGetUserByIdQuery} from "../utils/reducers/usersSlice";
import _ from "lodash";
import {SectionLoader} from "../utils/loaders";
import {useGetFeedByIdQuery} from "../utils/reducers/feedSlice";
import CompetitionForm from "../forms/competitionForm";
import JoinTeamForm from "../forms/joinTeamForm";
import ActivityGoalsForm from "../forms/activityGoalsForm";
import {
    ChangeTeamButton, LeaveButton,
    ModifyGoalsButton,
    RefreshButton,
    SettingsButton, ShareButton,
    StravaButton
} from "../forms/basicComponents";
import {BoxSection, ErrorBoxSection, PageWrapper, useDarkMode} from "../utils/miscellaneous";
import {workoutTypes} from "../forms/workoutForm";
import CompetitionInviteModal from "../forms/shareModal";
import {useDispatch} from "react-redux";
import {useLeaveCompetitionMutation} from "../utils/reducers/joinSlice";
import TransferOwnershipForm from "../forms/transferOwnershipForm";
import {teamsApi} from "../utils/reducers/teamsSlice";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend, BarElement, ChartDataLabels);


function CompetitionHead({competition, feed, isOwner}) {

    const [showEditCompetitionModal, setShowEditCompetitionModal] = useState(false);
    const [showInviteCompetitionModal, setShowInviteCompetitionModal] = useState(false);
    const [showTransferCompetitionModal, setShowTransferCompetitionModal] = useState(false);
    const [countTotal, setCountTotal] = useState(0);
    const [countGroups, setCountGroups] = useState({});

    useEffect(() => {
        const filteredFeed = _.filter(_.values(feed), item => item.workout !== null && item.workout__sport_type !== 'Steps');
        const totalCount = filteredFeed.length;
        setCountTotal(totalCount);
        const grouped = _.mapValues(_.groupBy(_.values(filteredFeed), 'workout__sport_type'), group => group.length);
        const sorted = _.fromPairs(_.orderBy(_.toPairs(grouped), ([, value]) => value, 'desc'));
        const limited = Object.fromEntries(Object.entries(sorted).slice(0, 4));
        setCountGroups(limited);
    }, [feed]);

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [leaveCompetition, {
        error: leaveError,
        isLoading: leaveIsLoading,
        isSuccess: leaveIsSuccess
    }] = useLeaveCompetitionMutation();

    async function triggerLeaveCompetition() {
        const confirmation = window.confirm('Are you sure you want to leave the competition? Your earned points for yourself and your team will be unrecoverably deleted and you loose your spot on the leaderboard.');
        if (confirmation) {
            try {
                const data = await leaveCompetition(competition.id).unwrap();
                console.log('Successfully left competition:', data);
                dispatch(competitionsApi.util.invalidateTags([{ type: 'Competition', id: competition.id }]));
                navigate('/dashboard');
            } catch (err) {
                console.error('Error leaving completion:', err);
                window.alert('Error leaving competition. Please try again.');
            }

        }
    }



    return (
        <BoxSection additionalClasses="mb-4">
            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center sm:gap-6 sm:py-4">
                <div className="space-y-1 pl-0 sm:pl-6 pb-3 sm:pb-0 text-center sm:text-left">
                    <p className="text-2xl font-semibold">{competition.name}</p>
                    <p className="font-small text-gray-500">{competition.start_date_fmt} - {competition.end_date_fmt}</p>

                </div>
                <div className="flex p-3">
                    <div className="flex items-center px-4">
                        <div className="text-5xl font-semibold pe-2">{countTotal}</div>
                        <div className="uppercase text-xs tracking-wide text-gray-500">Total Competition<br/>Workouts
                        </div>
                    </div>
                    {Object.entries(countGroups).map(([label, count], index) => (
                        <div key={"stat" + index} className="flex flex-col px-4 text-center hidden lg:block">
                            <div className="text-3xl font-semibold text-left">{count}</div>
                            <div className="uppercase text-xs tracking-wide text-gray-500">{workoutTypes[label].label_short}</div>
                        </div>
                    ))}
                </div>
                <div className="p-2 sm:p-4">
                    {
                        (isOwner) ? <SettingsButton  additionalClasses="mx-auto sm:ml-auto sm:mr-0 my-1" onClick={() => setShowEditCompetitionModal(competition.id)}/> :
                            <LeaveButton additionalClasses="mx-auto sm:ml-auto sm:mr-0 my-1" onClick={() => triggerLeaveCompetition()} isLoading={leaveIsLoading} />
                    }
                    <ShareButton  additionalClasses="mx-auto sm:ml-auto sm:mr-0 my-1" onClick={() => setShowInviteCompetitionModal(true)} />
                </div>
            </div>

            {(showEditCompetitionModal) && <CompetitionForm setModalState={setShowEditCompetitionModal} setShowTransferCompetitionModal={setShowTransferCompetitionModal} competition={competition}/>}
            {(showInviteCompetitionModal) && <CompetitionInviteModal setModalState={setShowInviteCompetitionModal} competition={competition}/>}
            {(showTransferCompetitionModal) && <TransferOwnershipForm setModalState={setShowTransferCompetitionModal} competition={competition}/>}

        </BoxSection>
    )
}


function ChartThisWeek({history}) {
    const isDarkMode = useDarkMode();
    const data = {
        labels: history['Legend'],
        datasets: [
            {
                label: 'Me',
                data: history['Me'],
                backgroundColor: 'rgb(99, 135, 188)',
                borderRadius: 5,
                clip: false,
            },
            {
                label: 'My Team',
                data: history['My Team'],
                backgroundColor: 'rgb(75, 192, 192)',
                borderRadius: 5,
                clip: false,
                hidden: true,
            },
            {
                label: 'Average',
                data: history['Average'],
                backgroundColor: 'rgb(156, 163, 175)',
                borderRadius: 5,
                clip: false,
                hidden: true,
            },
        ],
    };

    const options = {
        scales: {
            x: {
                display: true,
                ticks: {display: true},
                grid: {display: false},
            },
            y: {display: false},
        },
        layout: {
            padding: {
                top: 30, // Adjust as needed
            },
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom', // move legend to bottom
                labels: {
                    boxWidth: 12,
                    padding: 20,
                },
            },
            tooltip: false,
            datalabels: {
                anchor: 'end',
                align: 'end',
                color: isDarkMode ? '#fff' : '#000',
                font: {weight: 'bold'},
            },
        },
    };

    return (
        <Bar data={data} options={options} plugins={[ChartDataLabels]}/>
    )
}


function ChartHistory({history}) {
    const data = {
        labels: history['Legend'],
        datasets: [
            {
                label: 'Me',
                data: history['Me'],
                borderColor: 'rgb(99, 135, 188)',
                tension: 0.3, // slight smoothing
                fill: false,
                spanGaps: true,
            },
            {
                label: 'My Team',
                data: history['My Team'],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.3, // slight smoothing
                fill: false,
                spanGaps: true,
            },
            {
                label: 'Average',
                data: history['Average'],
                borderColor: 'rgb(156, 163, 175)',
                tension: 0.3, // slight smoothing
                fill: false,
                spanGaps: true,
            },
        ],
    };

    const options = {
        scales: {
            x: {display: false},
            y: {
                display: true,
                position: 'right',
                grid: {display: false},
                ticks: {
                    padding: 10,
                    color: '#666',
                },
            },
        },
        layout: {
            padding: {
                left: 20,
                right: 5,
                top: 10,
            },
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom', // move legend to bottom
                labels: {
                    boxWidth: 12,
                    padding: 20,
                },
            },
            datalabels: {display: false},
        },
    };
    return (
        <Line data={data} options={options}/>
    )
}


function AwardsBox({competition}) {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 mr-2 mb-4">
            <div className="flex flex-row">
                <span
                    className="mx-4 flex text-gray-500 uppercase font-bold items-center justify-center"><p>My Awards</p></span>
                <div className="h-full w-px bg-gray-300"></div>
                <div className="relative h-full w-[80px]">
                    <img src="/gold_medal.png" alt="Background" className="w-full h-full object-cover"/>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <h2 className="text-gray-500 text-sm text-center">Your Text Here</h2>
                    </div>
                </div>
                <div className="relative h-full w-[80px]">
                    <img src="/bronce_medal.png" alt="Background" className="w-full h-full object-cover"/>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <h2 className="text-gray-300 text-sm text-center">Your Text Here</h2>
                    </div>
                </div>
                <span className="ml-auto mx-4 flex text-light-blue font-semibold items-center justify-center"><p>View All</p></span>
            </div>
        </div>
    )
}

function TeamLeaderboardBox({stats, competition, user, teamId, isOwner}) {
    const dispatch = useDispatch();

    const [showChangeTeamModal, setShowChangeTeamModal] = useState(false);
    function setShowChangeTeamModalMiddleware(state) {
        if (state === false) {
            dispatch(statsApi.util.invalidateTags([{ type: 'Stats', id: competition.id }]));
        }
        setShowChangeTeamModal(state);
    }

    return (
        <>
            <BoxSection>
                <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                    <span className="mx-4 text-gray-500 uppercase font-bold">Team Leaderboard</span>
                    {(!competition.organizer_assigns_teams || isOwner) && (
                        <div className="p-0 mt-2.5 sm:mt-0">
                            <ChangeTeamButton onClick={() => setShowChangeTeamModalMiddleware(true)} larger={false}/>
                        </div>
                    )}
                </div>


                <table className="min-w-full my-2">
                    <tbody>
                    {(stats.leaderboard.team.length === 0) ? (
                        <tr className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                            <td className="py-2 px-4 pb-3 text-center text-gray-500">Create the first team!
                            </td>
                        </tr>
                    ) : (
                        stats.leaderboard.team.map((team, index) => (
                            <tr key={"leader_team" + index}
                                className={((parseInt(teamId) === team.workout__user__my_teams__id) ? "bg-sky-50 dark:bg-sky-950 " : "") + "hover:bg-gray-100 dark:hover:bg-gray-900 border-b"}>
                                <td className="py-2 px-2">
                                    <span className="font-semibold">#{team.rank}</span>
                                </td>
                                <td className="py-2 px-2">
                                    <span className="font-semibold">{team.name}</span>
                                </td>
                                <td className="py-2 px-2 group relative inline-block cursor-pointer">
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <UsersRound className="h-3.5 w-3.5"/> {team.members.length}
                                </span>
                                    <div
                                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-10">
                                        <p className="text-sm font-semibold">Members:</p>
                                        <ul className="text-sm list-disc pl-5">
                                            {team.members.map((user, usr_index) => (
                                                <li key={"leader_user" + usr_index}>{user.username} {Math.round(user.total_capped, 0).toLocaleString()}P</li>
                                            ))}
                                        </ul>

                                    </div>
                                </td>
                                <td className="py-2 px-2 text-right">
                                <span
                                    className="font-semibold">{Math.round(team.total_capped, 0).toLocaleString()}P</span>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
                {(competition.organizer_assigns_teams) ? <div className="pt-1 w-full text-center text-sm text-gray-500 italic"><b>Note:</b> The organizer assigns teams!</div> : null}
            </BoxSection>

            {(showChangeTeamModal) && <JoinTeamForm setModalState={setShowChangeTeamModalMiddleware} competition={competition} user={user} isOwner={isOwner}/>}

        </>
    )
}

function IndividualLeaderboardBox({stats, userId}) {

    return (
        <BoxSection>
            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold">Participant Leaderboard</span>
            </div>

            <table className="min-w-full my-2">
                <tbody>
                {(stats.leaderboard.individual.length === 0) ? (
                    <tr className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                        <td className="py-2 px-4 pb-3 text-center text-gray-500">Here participants will show up!
                        </td>
                    </tr>
                ) : (
                stats.leaderboard.individual.map((person, index) => (
                    <tr key={"leader_user" + index} className={((userId === person.workout__user__id) ? "bg-sky-50 dark:bg-sky-950 " : "") + "hover:bg-gray-100 dark:hover:bg-gray-900 border-b"}>
                        <td className="py-2 px-2">
                            <span className="font-semibold">#{person.rank}</span>
                        </td>
                        <td className="py-2 px-2">
                            <span className="font-semibold">{person.username}</span>
                        </td>
                        <td className="py-2 px-2">
                            {(person.strava_allow_follow === true && person.strava_athlete_id) && (
                                <StravaButton label={"Follow"} onClick={() => {
                                    window.open("https://www.strava.com/athletes/" + person.strava_athlete_id, "_blank")
                                }}/>
                            )}
                        </td>
                        <td className="py-2 px-2 text-right">
                            <span
                                className="font-semibold">{Math.round(person.total_capped, 0).toLocaleString()}P</span>
                        </td>
                    </tr>
                ))
                )}
                </tbody>
            </table>
        </BoxSection>
    )
}


function FeedBox({feed, refreshCompetition, competitionIsRefreshing}) {

    return (
        <BoxSection>

            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold">Activity Feed</span>
                <div className="p-0 mt-2.5 sm:mt-0">
                    <RefreshButton onClick={() => refreshCompetition()}
                                   label={"Refresh" + (competitionIsRefreshing ? "ing" : "") + " Competition"}
                                   larger={false} isLoading={competitionIsRefreshing}/>
                </div>
            </div>

            <table className="min-w-full my-2">
                <tbody>
                {(feed.length === 0) ? (
                    <tr className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                        <td className="py-2 px-4 pb-3 text-center text-gray-500">Here participants' activities will show
                            up!
                        </td>
                    </tr>
                ) : (feed.map((entry, index) => {
                        return (
                            <tr key={"feed" + index} className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                                <td className="py-2 px-4 text-sm md:text-base">
                                    <span className="font-semibold">{entry.workout__start_datetime_fmt.date_readable}</span><br/>
                                    <span className="text-sm hidden sm:block">{entry.workout__start_datetime_fmt.time_24h}</span>
                                </td>
                                <td className="py-2 px-4 block md:table-cell">
                                    {/* Mobile view (stacked) */}
                                    <div className="md:hidden">
                                        <div className="font-medium">{entry.workout__user__username}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">{(entry.workout__sport_type === "Steps") ? entry.workout__steps?.toLocaleString() : Math.round(parseFloat(entry.workout__duration) / 60, 0).toLocaleString() + "min"}<span className="font-semibold"> {workoutTypes[entry.workout__sport_type].label_short}</span></div>
                                    </div>
                                    {/* Desktop view (normal) */}
                                    <div className="hidden md:block">{entry.workout__user__username}</div>
                                </td>
                                <td className="py-2 px-4 hidden md:table-cell">{(entry.workout__sport_type === "Steps") ? entry.workout__steps?.toLocaleString() : Math.round(parseFloat(entry.workout__duration) / 60, 0).toLocaleString() + "min"}<span
                                    className="font-semibold"> {workoutTypes[entry.workout__sport_type].label_short}</span>
                                </td>
                                <td className="py-2 px-0 sm:px-4">
                                    {(entry.workout__user__strava_allow_follow && entry.workout__strava_id) ? (
                                        <StravaButton label={"Like Activity"} additionalClasses={"hidden sm:flex"}
                                                      onClick={() => {
                                                          window.open("https://www.strava.com/activities/" + entry.workout__strava_id, "_blank")
                                                      }}/>
                                    ) : null}
                                </td>
                                <td className="py-2 px-4 group relative inline-block pt-5 cursor-pointer">
                                    <span
                                        className="">+{Math.round(entry.points_capped, 0).toLocaleString()}P{(entry.points_capped !== entry.points_raw) ?
                                        <span className="text-gray-500">*</span> : null}</span>
                                    <div
                                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-white border dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-10">
                                        <p className="text-sm font-semibold">Breakdown:</p>
                                        <ul className="text-sm list-disc pl-5">
                                            {entry.details.map((detail, detail_index) => (
                                                <li key={"feed" + detail_index + "detail" + detail_index}>{detail.goal__name} +{Math.round(detail.points_capped, 0).toLocaleString()}P {(detail.points_raw !== detail.points_capped) ? (
                                                    <span
                                                        className="text-gray-500 italic"> (uncapped +{Math.round(detail.points_raw, 0).toLocaleString()}P)</span>) : null}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                        )
                    }
                ))}
                </tbody>
            </table>
        </BoxSection>
    )
}

function ActivityGoalsBox({user, stats, feed, competitionId, userId, isOwner}) {

    const [showModifyGoals, setShowModifyGoals] = useState(false);

    const goals = stats.competition.goals;
    const [finalGoals, setFinalGoals] = useState(goals);

    useEffect(() => {

        const now = new Date();

        // daily goal - get today 00:00 o'clock
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const epochTimeToday = Math.floor(today.getTime() / 1000); // In seconds

        // week goal - get Monday epoch time
        const day = now.getDay(); // 0 (Sun) to 6 (Sat)
        const diffMonday = (day + 6) % 7; // Days since last Monday
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - diffMonday);
        lastMonday.setHours(0, 0, 0, 0);
        const epochTimeMonday = Math.floor(lastMonday.getTime() / 1000); // In seconds

        // month goal - get first of month
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        firstOfMonth.setHours(0, 0, 0, 0);
        const epochTimeMonth = Math.floor(firstOfMonth.getTime() / 1000); // In seconds

        const filteredCompetition = _.filter(feed || [], item => item.workout__user === userId);
        const filteredDay = _.filter(filteredCompetition, item => item.workout__start_datetime_fmt.epoch >= epochTimeToday);
        const filteredWeek = _.filter(filteredCompetition, item => item.workout__start_datetime_fmt.epoch >= epochTimeMonday);
        const filteredMonth = _.filter(filteredCompetition, item => item.workout__start_datetime_fmt.epoch >= epochTimeMonth);

        let tmpGoals = [];
        for (const goal of goals) {

            let filteredList = [];
            if (goal.period === 'day') {
                filteredList = filteredDay;
            } else if (goal.period === 'week') {
                filteredList = filteredWeek;
            } else if (goal.period === 'month') {
                filteredList = filteredMonth;
            } else if (goal.period === 'competition') {
                filteredList = filteredCompetition;
            }

            let scaling = 1;
            if (['kcal', 'kj'].includes(goal.metric)) {
                scaling = user?.scaling_kcal ?? 1;
            } else if (['km'].includes(goal.metric)) {
                scaling = user?.scaling_distance ?? 1;
            }

            tmpGoals.push({
                ...goal,
                goal: goal.goal * scaling,
                min_per_workout: goal.min_per_workout !== null ? goal.min_per_workout * scaling : null,
                max_per_workout: goal.max_per_workout !== null ? goal.max_per_workout * scaling : null,
                min_per_day: goal.min_per_day !== null ? goal.min_per_day * scaling : null,
                max_per_day: goal.max_per_day !== null ? goal.max_per_day * scaling : null,
                min_per_week: goal.min_per_week !== null ? goal.min_per_week * scaling : null,
                max_per_week: goal.max_per_week !== null ? goal.max_per_week * scaling : null,
                points_capped: _.sumBy(_.flatMap(filteredList, 'details').filter(item => item.goal === goal.id), 'points_capped'),
                points_raw: _.sumBy(_.flatMap(filteredList, 'details').filter(item => item.goal === goal.id), 'points_raw'),
            })
        }
        setFinalGoals(tmpGoals);
    }, [stats, feed, userId]);


    return (
        <BoxSection>
            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold">Activity Goals</span>
                {isOwner && (
                    <div className="p-0 mt-2.5 sm:mt-0">
                        <ModifyGoalsButton onClick={() => setShowModifyGoals(true)}/>
                    </div>
                )}
            </div>
            <div className="flex flex-col">
                {finalGoals.map((goal, index) => (
                    <div key={"activitygoal" + index}
                         className="bg-gray-100 dark:bg-gray-900 rounded-lg p-5 m-4 mb-1 group relative">
                        <div className="flex flex-col px-4 text-left">
                            <div className="flex flex-row justify-between items-center text-gray-500 mb-0.5">
                                <div className="tracking-wide"><span className="font-semibold">{goal.name}</span>
                                </div>
                                <div>{Math.round(goal.goal).toLocaleString()} {goal.metric} <span
                                    className="text-xs">/ {goal.period}</span>
                                </div>
                            </div>
                            <div className="flex flex-row pt-2.5 pb-1 justify-between items-center">
                                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-4"
                                     style={{width: "75%"}}>
                                    <div className="h-4 rounded-full"
                                         style={{
                                             width: Math.min(goal.points_capped, 100) + "%",
                                             backgroundColor: "rgb(99, 135, 188)"
                                         }}></div>
                                </div>
                                <div className="text-sky-800 text-right"
                                     style={{width: "25%"}}>{Math.round(goal.points_capped).toLocaleString()} P<span
                                    className="text-sm"></span>
                                </div>
                            </div>

                            <div className="text-sm text-gray-400 pt-1.5 hidden group-hover:block">
                                <span className="font-semibold">Limits: </span>
                                {(!(goal.min_per_workout || goal.max_per_workout || goal.min_per_day || goal.max_per_day || goal.min_per_week || goal.max_per_week)) && (
                                    <>None</>
                                )}
                                {(goal.min_per_workout) && (
                                    <><ArrowDownToLine
                                        className="w-4 h-4 inline"/> {Math.round(goal.min_per_workout).toLocaleString()} </>
                                )}
                                {(goal.max_per_workout) && (
                                    <><ArrowUpToLine
                                        className="w-4 h-4 inline"/> {Math.round(goal.max_per_workout).toLocaleString()} </>
                                )}
                                {(goal.min_per_workout || goal.max_per_workout) && (
                                    <span className="text-xs">{goal.metric} / workout </span>
                                )}
                                {(goal.min_per_day) && (
                                    <><ArrowDownToLine
                                        className="w-4 h-4 inline"/> {Math.round(goal.min_per_day).toLocaleString()} </>
                                )}
                                {(goal.max_per_day) && (
                                    <><ArrowUpToLine
                                        className="w-4 h-4 inline"/> {Math.round(goal.max_per_day).toLocaleString()} </>
                                )}
                                {(goal.min_per_day || goal.max_per_day) && (
                                    <span className="text-xs">{goal.metric} / day </span>
                                )}
                                {(goal.min_per_week) && (
                                    <><ArrowDownToLine
                                        className="w-4 h-4 inline"/> {Math.round(goal.min_per_week).toLocaleString()} </>
                                )}
                                {(goal.max_per_week) && (
                                    <><ArrowUpToLine
                                        className="w-4 h-4 inline"/> {Math.round(goal.max_per_week).toLocaleString()} </>
                                )}
                                {(goal.min_per_week || goal.max_per_week) && (
                                    <span className="text-xs">{goal.metric} / week </span>
                                )}

                                {
                                    (['kcal', 'kj', 'km'].includes(goal.metric) && (Math.abs(user.scaling_distance - 1) >= 0.01 || Math.abs(user.scaling_kcal - 1) >= 0.01)) && (
                                        <>
                                            <br/>
                                            <span className="font-semibold">Equalizing Factor: </span>
                                            {
                                                (goal.metric === 'km') ? (
                                                    <span className="text-xs">{Math.round(user.scaling_distance * 100 * 10) / 10}% x {Math.round(goal.goal / user.scaling_distance).toLocaleString()} {goal.metric}</span>
                                                ) : (
                                                    <span className="text-xs">{Math.round(user.scaling_kcal * 100 * 100) / 100}% x {Math.round(goal.goal / user.scaling_kcal).toLocaleString()} {goal.metric}</span>
                                                )
                                            }
                                        </>
                                    )
                                }
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {
                (showModifyGoals) ?
                    <ActivityGoalsForm setModalState={setShowModifyGoals} competitionId={competitionId}/> : null
            }
        </BoxSection>
    );
}


function getWeekDates() {
    const today = new Date();
    const day = today.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (day === 0 ? -6 : 1) - day;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    return Array.from({length: 7}, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        const offset = Math.floor((today - d) / (1000 * 60 * 60 * 24));
        return {
            date: d.toLocaleDateString('en-CA'), // Canadian locale uses YYYY-MM-DD format by default
            offset: offset,
            dateObj: d
        };
    });
}

function Activity7DaysBox({stats, userId, teamId}) {

    const [chartData, setChartData] = useState({'labels': [], 'Me': [], 'My Team': [], 'Average': []});

    useEffect(() => {
        let tmpLegend = [];
        let tmpMe = [];
        let tmpTeam = [];
        let tmpAll = [];
        const participantCount = Math.max(1, stats.competition?.active_member_count);
        const teamMemberCount = Math.max(1, stats.teams[teamId]?.active_member_count);
        for (const entry of getWeekDates()) {
            tmpLegend.push(entry.dateObj.toLocaleDateString('en-US', {weekday: 'short'}));
            tmpMe.push(Math.round(stats?.timeseries?.user?.[userId]?.[entry.offset]?.total * 10) / 10 || 0);
            tmpTeam.push(Math.round(stats?.timeseries?.team?.[teamId]?.[entry.offset]?.total / teamMemberCount * 10) / 10 || 0);
            tmpAll.push(Math.round(stats?.timeseries?.all?.[entry.offset]?.total / participantCount * 10) / 10 || 0);
        }
        setChartData({
            'Legend': tmpLegend,
            'Me': tmpMe,
            'My Team': tmpTeam,
            'Average': tmpAll
        });
    }, [stats, userId, teamId]);

    return (
        <BoxSection>
            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold">This Week</span>
            </div>
            <div className="my-3">
                <ChartThisWeek history={chartData}/>
            </div>
        </BoxSection>)
}

function getDateRange(start_date, end_date) {
    const start = new Date(start_date);
    const today = new Date();
    const end = end_date ? new Date(end_date) : today;

    const finalEnd = end > today ? today : end;

    const dates = [];
    let current = new Date(start);

    while (current <= finalEnd) {
        const offset = Math.floor((today - current) / (1000 * 60 * 60 * 24));
        dates.push({
            date: current.toLocaleDateString('en-CA'), // Canadian locale uses YYYY-MM-DD format by default
            offset: offset,
            dateObj: new Date(current)
        });
        current.setDate(current.getDate() + 1);
    }

    return dates;
}


function ActivityCompetitionBox({stats, userId, teamId}) {

    const [chartData, setChartData] = useState({'labels': [], 'Me': [], 'My Team': [], 'Average': []});

    useEffect(() => {
        let tmpLegend = ['Start'];
        let tmpMe = [0];
        let prevMe = 0;
        let tmpTeam = [0];
        let prevTeam = 0;
        let tmpAll = [0];
        let prevAll = 0;
        const participantCount = Math.max(1, stats.competition?.active_member_count);
        const teamMemberCount = Math.max(1, stats.teams[teamId]?.active_member_count);
        for (const entry of getDateRange(stats?.competition?.start_date, stats?.competition?.end_date)) {
            tmpLegend.push(entry.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })); // Mon, Jan 5
            tmpMe.push((stats?.timeseries?.user?.[userId]?.[entry.offset]?.total + prevMe) || null);
            prevMe += (stats?.timeseries?.user?.[userId]?.[entry.offset]?.total || 0);
            tmpTeam.push((stats?.timeseries?.team?.[teamId]?.[entry.offset]?.total / teamMemberCount + prevTeam) || null);
            prevTeam += (stats?.timeseries?.team?.[teamId]?.[entry.offset]?.total / teamMemberCount || 0);
            tmpAll.push((stats?.timeseries?.all?.[entry.offset]?.total / participantCount + prevAll) || null);
            prevAll += (stats?.timeseries?.all?.[entry.offset]?.total / participantCount || 0);
        }
        setChartData({
            'Legend': tmpLegend,
            'Me': tmpMe,
            'My Team': tmpTeam,
            'Average': tmpAll
        });
    }, [stats, userId, teamId]);

    return (
        <BoxSection>
            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold">The Trend</span>
            </div>
            <div className="my-3">
                <ChartHistory history={chartData}/>
            </div>
        </BoxSection>
    )
}


export default function Competition() {
    const navType = useNavigationType();
    useEffect(() => {
        if (navType === "POP") {
            document.body.classList.remove("body-no-scroll");
        }
    }, [navType]);

    const dispatch = useDispatch();
    const {id} = useParams();

    const {
        data: user,
        error: userError,
        isLoading: userLoading,
    } = useGetUserByIdQuery('me');

    const {
        data: competition,
        error: competitionError,
        isLoading: competitionLoading,
        refetch: refreshCompetition,
        isFetching: competitionFetching,
    } = useGetCompetitionByIdQuery(id);

    const {
        data: feed,
        error: feedError,
        isLoading: feedLoading,
        refetch: refreshFeed,
        isFetching: feedFetching,
    } = useGetFeedByIdQuery(id, {
        pollingInterval: 90000, // 90 seconds
    });

    const {
        data: stats,
        error: statsError,
        isLoading: statsLoading,
        refetch: refreshStats,
        isFetching: statsFetching,
    } = useGetStatsByIdQuery(id, {
        pollingInterval: 90000, // 90 seconds
    });

    const isOwner = (user !== undefined) && (user?.id === competition?.owner);

    const [teamId, setTeamId] = useState(undefined);
    useEffect(() => {
        if (stats?.teams && user?.my_teams) {
            const tmpTeamId = Object.keys(stats?.teams).find(item => user?.my_teams.includes(parseInt(item)));
            setTeamId(tmpTeamId);
        }
    }, [stats, user])

    function refreshPage() {
        refreshCompetition();
        refreshFeed();
        refreshStats();
        dispatch(teamsApi.util.invalidateTags(['Team']));
    }

    if (competitionError) {
        console.log('Error retrieving competition:', id, competitionError);
        return <PageWrapper additionClasses="h-screen flex items-center justify-center"><ErrorBoxSection
            errorMsg={competitionError?.status + ' / ' + (competitionError?.error || competitionError?.message || competitionError?.data?.detail)}/></PageWrapper>;
    }


    return (
        <PageWrapper>
            <NavMenu page={id}/>

            <div className="container mx-auto p-4">

                {
                    (competitionLoading || feedLoading) ? (
                        <SectionLoader height={"h-48 mb-4"} />
                    ) : (statsError) ? (
                        <ErrorBoxSection additionalClasses='mb-4' errorMsg={competitionError?.status + ' / ' + (competitionError?.error || competitionError?.message || competitionError?.data?.detail)}/>
                    ) : (
                        <CompetitionHead competition={competition} feed={feed} isOwner={isOwner} />
                    )
                }

                {/* KPI bar */}
                <div className="flex flex-col xl:flex-row">
                    <div className="w-full xl:w-1/3">
                        {
                            (statsLoading || feedLoading || userLoading) ? (
                                <SectionLoader/>
                            ) : (statsError) ? (
                                <ErrorBoxSection additionalClasses="mb-4"
                                    errorMsg={statsError?.status + ' / ' + (statsError?.error || statsError?.message || statsError?.data?.detail)}/>
                            ) : (
                                <ActivityGoalsBox user={user} stats={stats} feed={feed} competitionId={id} userId={user?.id} isOwner={isOwner} />
                            )
                        }
                    </div>
                    <div className="w-full xl:w-1/3 my-4 xl:my-0 xl:mx-4">
                        {
                            (statsLoading || userLoading) ? (
                                <SectionLoader/>
                            ) : (statsError) ? (
                                <ErrorBoxSection
                                    errorMsg={statsError?.status + ' / ' + (statsError?.error || statsError?.message || statsError?.data?.detail)}/>
                            ) : (
                                <Activity7DaysBox feed={feed} stats={stats} userId={user?.id} teamId={teamId}/>
                            )
                        }
                    </div>
                    <div className="w-full xl:w-1/3 ">
                        {
                            (statsLoading || userLoading) ? (
                                <SectionLoader/>
                            ) : (statsError) ? (
                                <ErrorBoxSection
                                    errorMsg={statsError?.status + ' / ' + (statsError?.error || statsError?.message || statsError?.data?.detail)}/>
                            ) : (
                                <ActivityCompetitionBox feed={feed} stats={stats} userId={user?.id} teamId={teamId}/>
                            )
                        }
                    </div>
                </div>

                {/* Leaderboards & Activity */}
                <div className="flex flex-col xl:flex-row mt-4">

                    {/* Activity Feed – left on xl, below otherwise */}
                    <div className="order-2 xl:order-1 w-full xl:w-2/3 xl:pr-2">
                        {
                            (feedLoading) ? <SectionLoader height={"h-80"}/> : (feedError) ? (
                                <ErrorBoxSection
                                    errorMsg={feedError?.status + ' / ' + (feedError?.error || feedError?.message || feedError?.data?.detail)}/>
                            ) : (
                                <FeedBox feed={feed} refreshCompetition={refreshPage}
                                         competitionIsRefreshing={competitionFetching || feedFetching || statsFetching}/>
                            )
                        }
                    </div>

                    {/* Leaderboards – above Activity on sm/md/lg, right on xl */}
                    <div className="order-1 xl:order-2 w-full xl:w-1/3 mb-1 xl:mb-0 flex flex-col md:flex-row xl:flex-col xl:pl-2">
                        { (competition?.has_teams === false) ? null : (
                        <div className="w-full md:w-1/2 xl:w-full pr-0 md:pr-2 xl:pr-0 mb-4">
                            {
                                (statsLoading || competitionLoading) ? (
                                    <SectionLoader/>
                                ) : (statsError) ? (
                                    <ErrorBoxSection
                                        errorMsg={statsError?.status + ' / ' + (statsError?.error || statsError?.message || statsError?.data?.detail)}/>
                                ) : (
                                    <TeamLeaderboardBox stats={stats} competition={competition} user={user} teamId={teamId} isOwner={isOwner}/>
                                )
                            }
                        </div>
                        )}
                        <div className="w-full md:w-1/2 xl:w-full pl-0 md:pl-2 xl:pl-0 mb-4">
                            {
                                (statsLoading) ? (
                                    <SectionLoader/>
                                ) : (statsError) ? (
                                    <ErrorBoxSection
                                        errorMsg={statsError?.status + ' / ' + (statsError?.error || statsError?.message || statsError?.data?.detail)}/>
                                ) : (
                                    <IndividualLeaderboardBox stats={stats} userId={user?.id}/>
                                )
                            }
                        </div>
                    </div>
                </div>
            </div>

        </PageWrapper>
    )
}