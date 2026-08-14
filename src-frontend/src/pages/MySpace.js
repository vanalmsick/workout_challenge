import './Dashboard.css';
import React, {useEffect, useState} from "react";
import {
    Check,
    CheckCheck,
    Dumbbell,
    Flame,
    Timer,
    Ruler,
} from 'lucide-react';
import {useGetWorkoutsQuery, workoutsApi} from "../utils/reducers/workoutsSlice";
import WorkoutForm, {workoutTypes} from "../forms/workoutForm";
import _ from 'lodash';
import {useGetUserByIdQuery, usersApi} from "../utils/reducers/usersSlice";
import {useGetCompetitionsQuery} from "../utils/reducers/competitionsSlice";
import CompetitionForm from "../forms/competitionForm";
import PersonalGoalsForm from "../forms/personalGoalsForm";
import SettingsForm from "../forms/settingsForm";
import {useLocation, useNavigate, useNavigationType, useSearchParams} from "react-router";
import NavMenu from "../utils/navMenu";
import JoinCompetitionForm from "../forms/joinCompetitionForm";
import {HowToScreen, LinkStravaScreen} from "./HowTo";
import {
    AddButton, EditButton, FairGoalsButton,
    JoinButton,
    ModifyGoalsButton,
    SettingsButton, StravaButton,
    SyncStravaButton
} from "../forms/basicComponents";
import {BoxSection, ErrorBoxSection, PageWrapper} from "../utils/miscellaneous";
import {SectionLoader} from "../utils/loaders";
import {useDispatch} from "react-redux";
import GoalEqualizerForm from "../forms/equalizerForm";
import {useLazySyncStravaQuery} from "../utils/reducers/linkSlice";
import {statsApi, useGetStatsByIdQuery} from "../utils/reducers/statsSlice";
import {feedApi} from "../utils/reducers/feedSlice";
import {BeatLoader} from "react-spinners";


function WelcomeBox({user, workouts, setLinkStrava}) {

    const [showEditSettingsModal, setShowEditSettingsModal] = useState(false);
    const [showGoalEqualizerModal, setShowGoalEqualizerModal] = useState(false);
    const [countTotal, setCountTotal] = useState(0);
    const [countGroups, setCountGroups] = useState({});

    useEffect(() => {
        if (workouts !== undefined) {
            const filteredWorkouts = _.filter(workouts || [], item => item.sport_type !== 'Steps');
            setCountTotal(filteredWorkouts.length);
            const grouped = _.mapValues(_.groupBy(_.values(filteredWorkouts), 'sport_type'), group => group.length);
            const sorted = _.fromPairs(_.orderBy(_.toPairs(grouped), ([, value]) => value, 'desc'));
            const limited = Object.fromEntries(Object.entries(sorted).slice(0, 4));
            setCountGroups(limited);
        }
    }, [workouts]);

    return (
        <BoxSection additionalClasses={"mb-4"}>
            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center sm:gap-6 sm:py-4">

                {/* Message */}
                <div className="flex flex-col gap-2 px-5 pb-2 sm:flex-row sm:items-center sm:gap-6 sm:py-2.5">
                    <img className="mx-auto block h-24 rounded-full sm:mx-0 sm:shrink-0"
                         src="/profile.png"
                         alt=""/>
                    <div className="space-y-2 text-center sm:text-left">
                        <div className="space-y-0.5">
                            <p className="font-small text-gray-500">Welcome back,</p>
                            <p className="text-2xl font-semibold">{user.first_name}</p>
                        </div>
                    </div>
                </div>

                {/* Workout Stats */}
                <div className="flex p-3">
                    <div className="flex items-center px-4">
                        <div className="text-5xl font-semibold pe-2">{countTotal}</div>
                        <div className="uppercase text-xs tracking-wide text-gray-500">Total Lifetime<br/>Workouts
                        </div>
                    </div>
                    {Object.entries(countGroups).map(([label, count], index) => (
                        <div key={"stat" + index} className="flex flex-col px-4 text-center hidden lg:block">
                            <div className="text-3xl font-semibold text-left">{count}</div>
                            <div
                                className="uppercase text-xs tracking-wide text-gray-500">{workoutTypes[label].label_short}</div>
                        </div>
                    ))}
                </div>

                {/* Setting Buttons */}
                <div className="p-3 sm:p-4">
                    <SettingsButton additionalClasses="mx-auto sm:ml-auto sm:mr-0 my-1"
                                    onClick={() => setShowEditSettingsModal(true)}/>
                    <FairGoalsButton additionalClasses="mx-auto sm:ml-auto sm:mr-0 my-1"
                                     onClick={() => setShowGoalEqualizerModal(true)}/>
                </div>

                {(showEditSettingsModal) && (
                    <SettingsForm user={user} setModalState={setShowEditSettingsModal} setLinkStrava={setLinkStrava}/>
                )}
                {(showGoalEqualizerModal) && (
                    <GoalEqualizerForm user={user} setModalState={setShowGoalEqualizerModal}/>
                )}

            </div>
        </BoxSection>
    )
}


function WorkoutsBox({workouts, user, setLinkStrava}) {

    const [showEditWorkoutModal, setShowEditWorkoutModal] = useState(false);
    const stravaLinked = user?.strava_athlete_id !== null;
    const dispatch = useDispatch();
    const [triggerStravaSync, { data: stravaSyncData, isFetching: stravaSyncIsFetching, error: stravaSyncError, isSuccess: stravaSyncIsSuccess }] = useLazySyncStravaQuery();

    useEffect(() => {
        if (stravaSyncIsFetching !== undefined && stravaSyncIsFetching !== true) {
            if (stravaSyncIsSuccess) {
                dispatch(workoutsApi.util.invalidateTags(['Workout']));
                dispatch(usersApi.util.invalidateTags(['User']));
                dispatch(statsApi.util.invalidateTags(['Stats']));
                dispatch(feedApi.util.invalidateTags(['Feed']));
                console.log("Strava sync successful!");
            } else if (stravaSyncError) {
                dispatch(workoutsApi.util.invalidateTags(['Workout']));
                dispatch(usersApi.util.invalidateTags(['User']));
                if (stravaSyncError?.status === 429) {
                    console.log("Strava sync denied! Too many requests!");
                    window.alert(`${stravaSyncError?.data?.message}`);
                } else {
                    console.log("Strava sync failed!", stravaSyncError);
                    window.alert("Strava sync failed! Unknown error. Please try again later or wait till 4 am for scheduled sync.");
                }
            }
        }
    }, [stravaSyncIsFetching]);

    return (
        <BoxSection>

            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold mb-1.5 sm:mb-0">My Workouts</span>
                <div className="p-0">
                    {
                        (stravaLinked) ? <SyncStravaButton additionalClasses="my-0.5 sm:my-0" isLoading={stravaSyncIsFetching} onClick={() => triggerStravaSync()}/> :
                            <StravaButton additionalClasses="my-0.5 sm:my-0" label={"Link Strava for Automatic Import"} onClick={() => setLinkStrava(true)}/>
                    }
                </div>

                <div className="p-0">
                    <AddButton additionalClasses="my-0.5 sm:my-0" label={"Add Workout Manually"} onClick={() => setShowEditWorkoutModal(true)}/>
                </div>
            </div>

            <table className="min-w-full my-2">
                <tbody>
                {(workouts.length === 0) ? (
                    <tr className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                        <td className="py-2 px-4 pb-3 text-center text-gray-500">Add workouts manually or link Strava for automatic workout import!
                        </td>
                    </tr>
                ) : (
                    workouts.map((workout, iWorkout) => (
                        <tr key={"workout" + iWorkout} className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                            <td className="py-2 px-4 text-sm md:text-base">
                                <span className="font-semibold">{workout.start_datetime_fmt.date_readable}</span><br/>
                                <span className="text-sm hidden sm:block">{workout.start_datetime_fmt.time_24h}</span>
                            </td>
                            <td className="py-2 px-4 text-sm md:text-base">
                                {/* Mobile view (stacked) */}
                                <div className="md:hidden">
                                    <div className="font-base">{(workout.sport_type === "Steps") ? workout.steps?.toLocaleString() : workout.duration.substring(0, 5)} <span className="font-semibold">{workoutTypes[workout.sport_type].label_short}</span></div>
                                    {(workout.sport_type !== "Steps") && <div className="text-sm text-gray-600 dark:text-gray-400">{Math.round(workout.kcal).toLocaleString()}<span className="text-sm"> kcal < /span></div>}
                                </div>
                                {/* Desktop view (normal) */}
                                <div className="hidden md:block">{(workout.sport_type === "Steps") ? workout.steps?.toLocaleString() : workout.duration.substring(0, 5)} <span className="font-semibold text-base">{workoutTypes[workout.sport_type].label_short}</span> {(workout.distance && workout.sport_type !== "Steps") ? (<span className="hidden sm:inline">({workout.distance}km)</span>) : (null)}</div>
                            </td>
                            <td className="py-2 px-4 hidden md:table-cell">
                                {(workout.kcal) ? (
                                    (workout.sport_type !== "Steps") && (<>{Math.round(workout.kcal).toLocaleString()} <span className="text-sm"> kcal < /span></>)
                                ) : null}
                            </td>
                            <td className="py-2 px-4">
                                <EditButton additionalClasses={"mx-auto"}
                                            onClick={() => setShowEditWorkoutModal(workout.id)} label={false}
                                            larger={true}/>
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </table>

            {(showEditWorkoutModal) && (
                <WorkoutForm setModalState={setShowEditWorkoutModal} id={showEditWorkoutModal} scaling_distance={parseFloat(user?.scaling_distance || "1.0")}/>
            )}

        </BoxSection>
    )
}


function CompetitionRow({competition, user}) {

    const {
        data: stats,
        error: statsError,
        isLoading: statsLoading,
        refetch: refreshStats,
        isFetching: statsFetching,
    } = useGetStatsByIdQuery(competition.id, {
        pollingInterval: 90000, // 90 seconds
    });

    const [teamId, setTeamId] = useState(undefined);
    useEffect(() => {
        if (stats?.teams && user?.my_teams) {
            const tmpTeamId = Object.keys(stats?.teams).find(item => user?.my_teams.includes(parseInt(item)));
            setTeamId(tmpTeamId);
        }
    }, [stats, user])

    const navigate = useNavigate();
    const handleClick = (id) => {
        return navigate(`/competition/${id}`);
    }

    return (
        <tr onClick={() => handleClick(competition.id)}
            className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b cursor-pointer">
            <td className="py-2 px-4">
                <span className="font-semibold">{competition.name}</span><br/>
                <span className="text-sm text-gray-400">{competition.start_date_fmt} - {competition.end_date_fmt}</span>
            </td>
            <td className="py-2 px-4 text-right text-sm">
                {(statsLoading) ? (
                    <div><BeatLoader color="rgb(209 213 219)" /></div>
                ) : (stats.competition.start_date_count >= 0) ? (
                        ((stats.users[user.id]?.rank == null) ? (
                            <span className="text-gray-400">Time to work out!</span>
                        ) : (
                            <>No. <span className="text-xl font-semibold">{stats.users[user.id]?.rank}</span>
                                {(competition.has_teams) ? (
                                    <span className="text-gray-400 italic"><br/><span className="font-semibold">My Team:</span> #{stats.teams[teamId]?.rank}</span>
                                ) : null
                                }
                            </>
                        ))
                ) :
                <span className="text-gray-400">Not yet started</span>
            }
            </td>
        </tr>
    )
}



function CompetitionsBox({user, competitions, setJoinCompetition}) {

    const [showEditCompetitionModal, setShowEditCompetitionModal] = useState(false);

    return (
        <BoxSection additionalClasses={"mb-4"}>

            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center border-b-2 pb-3">
                <span className="mx-4 text-gray-500 uppercase font-bold mb-1.5 sm:mb-0">My Competitions</span>
                <div className="p-0">
                    <JoinButton additionalClasses="my-0.5 sm:my-0" onClick={() => setJoinCompetition(true)}/>
                </div>
                <div className="p-0">
                    <AddButton additionalClasses="my-0.5 sm:my-0" label={"Create"}
                               onClick={() => setShowEditCompetitionModal(true)}/>
                </div>
            </div>

            <table className="min-w-full my-2">
                <tbody>
                {(competitions.length === 0) ? (
                    <tr className="hover:bg-gray-100 dark:hover:bg-gray-900 border-b">
                        <td className="py-2 px-4 pb-3 text-center text-gray-500">Crate or join a competition!
                        </td>
                    </tr>
                ) : (
                    competitions.map((competition, iCompetition) => (
                        <CompetitionRow key={"comp" + iCompetition} competition={competition} user={user} />
                    ))
                )}
                </tbody>
            </table>

            {(showEditCompetitionModal) && (
                <CompetitionForm setModalState={setShowEditCompetitionModal}/>
            )}

        </BoxSection>
    )
}


function getLast5WeeksRange() {
    let cnt = 35;
    const today = new Date();
    const currentDay = today.getDay(); // 0 (Sun) - 6 (Sat)
    const isMonday = currentDay === 1;

    // Find this week's Monday
    const thisMonday = new Date(today);
    const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    thisMonday.setDate(today.getDate() + diffToMonday);

    // Find Monday 5 weeks ago
    const start = new Date(thisMonday);
    // If today is Monday, subtract 35 days (5 weeks), otherwise subtract 28 days (4 weeks)
    start.setDate(thisMonday.getDate() - (isMonday ? 35 : 28));

    // Find this week's Sunday
    const end = new Date(thisMonday);
    end.setDate(thisMonday.getDate() + 6); // Sunday of this week

    // Collect all dates
    const dates = [];
    const current = new Date(start);

    while (current <= end) {
        const offset = Math.floor((current - today) / (1000 * 60 * 60 * 24));
        dates.push({
            date: current.toLocaleDateString('en-CA'), // Canadian locale uses YYYY-MM-DD format by default
            week: Math.floor((cnt - 1) / 7) * (-1),
            offset: offset,
            dateObj: new Date(current),
            day: current.getDate(),          // Add day number (1-31)
            month: current.getMonth() + 1,   // Add month number (1-12)
            year: current.getFullYear(),     // Add year number (e.g., 2025)
            monthStr: current.toLocaleDateString('en-US', {month: 'short'}), // Jan, Feb, ...
        });
        current.setDate(current.getDate() + 1);
        cnt--;
    }

    return dates;
}


function ThirtyDayStats({thirtyDayStats}) {
    return (
        <div className="w-full">
            <div className="relative flex pb-5 pt-3 items-center text-sm">
                <span className="shrink mx-4 text-gray-500 uppercase"><span
                    className="font-bold">30 Day Activity</span> • {thirtyDayStats.startDate} - {thirtyDayStats.endDate}</span>
                <div className="grow border-t border-gray-100 border-t-2"></div>
            </div>
            <div className="flex p-3">
                <div className="flex flex-col px-4 text-left">
                    <div className="text-xs tracking-wide text-gray-500">Active Days</div>
                    <div className="text-6xl text-left">{thirtyDayStats.activeDays}</div>
                </div>
            </div>
            <div className="flex flex-wrap p-3 pt-1 space-y-3 space-x-1 sm:space-x-4">
                <div className="flex items-center">
                    <Dumbbell className="w-6 h-6 text-gray-500"/>
                    <div className="flex flex-col px-4 text-left">
                        <div className="text-xs tracking-wide text-gray-500">Workouts</div>
                        <div className="text-3xl">{thirtyDayStats.workouts}</div>
                    </div>
                </div>
                <div className="flex items-center">
                    <Timer className="w-6 h-6 text-gray-500"/>
                    <div className="flex flex-col px-4 text-left">
                        <div className="text-xs tracking-wide text-gray-500">Time</div>
                        <div><span
                            className="text-3xl">{Math.floor(thirtyDayStats.time / 3600).toLocaleString()}</span>hr <span
                            className="text-3xl">{Math.floor((thirtyDayStats.time % 3600) / 60)}</span>min
                        </div>
                    </div>
                </div>
                <div className="flex items-center">
                    <Flame className="w-6 h-6 text-gray-500"/>
                    <div className="flex flex-col px-4 text-left">
                        <div className="text-xs tracking-wide text-gray-500">Calories</div>
                        <div><span className="text-3xl">{thirtyDayStats.kcal.toLocaleString()}</span>kcal</div>
                    </div>
                </div>
                <div className="flex items-center">
                    <Ruler className="w-6 h-6 text-gray-500"/>
                    <div className="flex flex-col px-4 text-left">
                        <div className="text-xs tracking-wide text-gray-500">Distance</div>
                        <div><span className="text-3xl">{Math.round(thirtyDayStats.distance).toLocaleString()}</span>km
                        </div>
                    </div>
                </div>
            </div>
            <div className="relative flex py-5 items-center text-sm">
                <div className="grow border-t border-gray-100 border-t-2"></div>
            </div>
        </div>
    )
}

function SevenDayStats({sevenDayStats, user}) {

    const [showEditGoalsModal, setShowEditGoalsModal] = useState(false);

    return (
        <div className="w-full">
            <div className="relative flex py-5 items-center text-sm xl:hidden block">
                <div className="grow border-t border-gray-100 border-t-2"></div>
            </div>

            <div className="flex flex-col items-center justify-between sm:flex-row sm:items-center">
                <span className="text-sm mx-4 text-gray-500 uppercase"><span
                    className="font-bold">Personal Goals</span> • 7 Days Rolling</span>
                <div className="p-0">
                    <ModifyGoalsButton additionalClasses="mt-2.5 sm:my-0" onClick={() => setShowEditGoalsModal(true)}
                                       label={"Update Goals"}/>
                </div>
            </div>

            <div className="flex flex-col mt-3 sm:mt-0 sm:overflow-x-auto sm:flex-row sm:space-x-4">
                {sevenDayStats.map((goal, idx) => (
                    <div key={idx} className="bg-gray-100 dark:bg-gray-900 rounded-lg p-6 mb-4 sm:mb-0 sm:m-4">
                        <div className="flex flex-col px-4 text-left" style={{width: '220px'}}>
                            <div className="tracking-wide text-gray-500 mb-0.5">{goal.name}</div>
                            <div className="text-2xl text-sky-800 text-left mb-2">
                                {goal.value.toLocaleString()} / {goal.target.toLocaleString()}
                                <span className="text-sm">{goal.unit}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-4">
                                <div className="h-4 rounded-full" style={{
                                    width: Math.min(goal.value / goal.target * 100, 100) + '%',
                                    backgroundColor: '#6387bc'
                                }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {(showEditGoalsModal) && <PersonalGoalsForm user={user} setModalState={setShowEditGoalsModal}/>}

        </div>
    )
}


function splitIntoChunks(arr, chunkSize = 7) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}


function CalendarStats({workouts, last5Weeks}) {

    const [tableDateData, setTableDateData] = useState([]);
    const [tableStreakData, setTableStreakData] = useState({});
    const [weekStreak, setWeekStreak] = useState(0);

    const today = new Date();
    const isMonday = today.getDay() === 1;
    const weeks = (isMonday ? 5 : 4);

    useEffect(() => {
        const filteredWorkouts = _.filter(workouts || [], item => item.sport_type !== 'Steps');

        // chunked table data
        const hasWorkout = (list, value) => list.some(obj => obj.start_datetime_fmt.days_ago === -value) ? 1 : 0;
        const combinedData = last5Weeks.map(week => ({...week, hasWorkout: hasWorkout(filteredWorkouts, week.offset)}));
        const chunkedData = splitIntoChunks(combinedData);
        setTableDateData(chunkedData);
        const workoutsPerWeek = _.mapValues(_.groupBy(filteredWorkouts || [], 'start_datetime_fmt.weeksAgo'), items => _.sumBy(items, 'duration_seconds'));
        setTableStreakData(workoutsPerWeek);

        // streak number
        let weekStreak = -1;
        let i = -1;
        let stillStreak = true;
        while (stillStreak) {
            // workout done - add one to streak
            if (workoutsPerWeek[i + 1] > 0) {
                weekStreak++;
            // no workout done - break streak but only if this is not the current week
            } else if (i !== -1) {
                stillStreak = false;
            }
            i++;
        }
        setWeekStreak(weekStreak + 1);

    }, [workouts, last5Weeks]);

    return (
        <div className="w-full py-5">
            <table className="streak-table text-center mx-auto text-xs sm:text-sm">
                <thead>
                <tr className="font-semibold text-gray-500">
                    <th>M</th>
                    <th>T</th>
                    <th>W</th>
                    <th>T</th>
                    <th>F</th>
                    <th>S</th>
                    <th>S</th>
                    <th className="hidden md:block">Streak</th>
                </tr>
                </thead>
                <tbody>
                {/* Iterate over weeks/rows */}
                {tableDateData.map((week, idxWeek) => (
                    <tr key={"week" + idxWeek}>
                        {/* Iterate over days/cols */}
                        {week.map((day, idxDay) => (
                            <td key={"day" + idxDay} className="py-0 px-1 sm:px-2">
                                {/* Month 3 letters */}
                                <div className="mx-auto flex items-center justify-center text-gray-400 h-5">
                                    {((idxDay === 0 && idxWeek === 0) || day.day === 1) ? day.monthStr : null}
                                </div>
                                {/* Day Number */}
                                <div
                                    className={"mx-auto flex items-center justify-center w-8 h-8 rounded-full font-semibold " + ((day.offset <= 0 && day.offset > -30) ? (day.hasWorkout > 0 ? "bg-sky-800 text-white" : "") : (day.hasWorkout > 0 ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500" : "text-gray-300 dark:text-gray-500"))}>
                                    {day.day}
                                </div>
                                {/* Today dot */}
                                <div
                                    className={"mx-auto flex items-center justify-center w-1.5 h-1.5 mt-1 rounded-full" + (day.offset === 0 ? "  bg-red-600" : null)}></div>
                            </td>
                        ))}

                        {/* Week Streak */}
                        <td className="py-0 px-1 sm:px-2 hidden md:block">
                            <div
                                className="mx-auto flex items-center justify-center text-gray-300 h-5 font-bold">
                                {(tableStreakData[weeks - idxWeek + 1] > 0 && tableStreakData[weeks - idxWeek] > 0) ? "|" : ""}
                            </div>
                            <div
                                className={"mx-auto flex items-center justify-center w-8 h-8 rounded-full font-semibold text-white " + ((tableStreakData[weeks - idxWeek] > 0) ? "bg-streak-blue" : "bg-gray-200 dark:bg-gray-700")}>
                                {(tableStreakData[weeks - idxWeek] >= 9000) ? // double tick: 9000 = 150 minutes as recommended by the WHO
                                    <CheckCheck className="w-5 h-5"/> : (tableStreakData[weeks - idxWeek] > 0) ? // single tick: any workout
                                        <Check className="w-5 h-5"/> : ""}
                            </div>
                            <div
                                className="mx-auto flex items-center justify-center w-1.5 h-1.5 mt-1 rounded-full text-gray-300 font-bold">
                                {(tableStreakData[weeks - idxWeek - 1] > 0 && tableStreakData[weeks - idxWeek] > 0) ? "|" : ""}
                            </div>
                        </td>

                    </tr>
                ))}

                <tr>
                    <td colSpan="7"
                        className="cell-mon cell-sun text-sm text-center bg-gray-100 md:bg-white dark:bg-gray-900 dark:md:bg-gray-800 py-2">
                        <div className="md:hidden mx-auto flex items-center justify-center"><Check
                            className="w-4 h-4 mt-1 mr-2"/> {weekStreak} Week Streak
                        </div>
                    </td>
                    <td className="cell-streak hidden md:block" style={{color: '#6387bc'}}>
                        <span className="text-xl font-semibold">{weekStreak}</span><br/>
                        <span className="text-sm">weeks</span>
                    </td>
                </tr>

                </tbody>
            </table>
        </div>
    )
}


function StatsBox({workouts, user}) {

    const [thirtyDayStats, setThirtyDayStats] = useState({activeDays: 0, workouts: 0, distance: 0, kcal: 0, time: 0});
    const [sevenDayStats, setSevenDayStats] = useState([]);
    const last5WeeksList = getLast5WeeksRange();

    useEffect(() => {
        // 30 day stats
        const filtered30Days = _.filter(workouts || [], item => item.start_datetime_fmt.days_ago < 30 && item.sport_type !== 'Steps');
        setThirtyDayStats({
            activeDays: _.uniqBy(filtered30Days, 'start_datetime_fmt.date_iso').length,
            workouts: filtered30Days.length,
            distance: Math.round(_.sumBy(filtered30Days, item => +item.distance || 0) * 10) / 10,
            kcal: Math.round(_.sumBy(filtered30Days, item => +item.kcal || 0)),
            time: Math.round(_.sumBy(filtered30Days, item => +item.duration_seconds || 0)),
            startDate: _.find(last5WeeksList, {offset: -29})?.dateObj?.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }),
            endDate: _.find(last5WeeksList, {offset: 0})?.dateObj?.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }),
        })

        // 7 day goals
        const filtered7Days = _.filter(workouts || [], item => item.start_datetime_fmt.days_ago < 7 && item.sport_type !== 'Steps');
        let newGoals = [];
        if (user.goal_active_days !== null) {
            newGoals.push({
                name: 'Active Days',
                value: _.uniqBy(filtered7Days, 'start_datetime_fmt.date_iso').length,
                target: user.goal_active_days,
                unit: ''
            });
        }
        if (user.goal_workout_minutes !== null) {
            newGoals.push({
                name: 'Time Goal',
                value: Math.round(_.sumBy(filtered7Days, item => +item.duration_seconds || 0) / 60),
                target: user.goal_workout_minutes,
                unit: 'min'
            });
        }
        if (user.goal_distance !== null) {
            newGoals.push({
                name: 'Distance',
                value: Math.round(_.sumBy(filtered7Days, item => +item.distance || 0)),
                target: user.goal_distance,
                unit: 'km'
            });
        }
        setSevenDayStats(newGoals);
    }, [workouts, user]);

    return (
        <>
            <div className="w-full xl:flex-1 flex flex-col overflow-hidden mr-10">
                <ThirtyDayStats thirtyDayStats={thirtyDayStats}/>
                <div className="w-full xl:hidden">
                    <CalendarStats workouts={workouts} last5Weeks={last5WeeksList}/>
                </div>
                <SevenDayStats sevenDayStats={sevenDayStats} user={user}/>
            </div>
            <div className="xl:w-fit hidden xl:block xl:flex-none">
                <CalendarStats workouts={workouts} last5Weeks={last5WeeksList}/>
            </div>
        </>
    )
}


export default function MySpace() {
    const navigate = useNavigate();
    const navType = useNavigationType();
    useEffect(() => {
        if (navType === "POP") {
            document.body.classList.remove("body-no-scroll");
        }
    }, [navType]);

    const {
        data: user,
        error: userError,
        isLoading: userLoading,
    } = useGetUserByIdQuery('me');

    const {
        data: workouts,
        error: workoutsError,
        isLoading: workoutsIsLoading,
        refetch: refetchWorkouts,
        isFetching: workoutsIsFetching,
    } = useGetWorkoutsQuery(undefined, {
        pollingInterval: 10800000, // 3 hours
    });

    const {
        data: competitions,
        error: competitionError,
        isLoading: competitionLoading,
        isSuccess: competitionIsSuccess
    } = useGetCompetitionsQuery(undefined, {
        pollingInterval: 10800000, // 3 hours
    });

    const [searchParams, setSearchParams] = useSearchParams();
    const {search} = useLocation();
    const query = new URLSearchParams(search);
    const searchTermWelcome = query.get('welcome'); // null if not present
    const searchTermJoin = query.get('join'); // null if not present

    const [welcomeStep, setWelcomeStep] = useState(0);
    const [welcomeMessage, setWelcomeMessage] = useState(false);
    const [linkStrava, setLinkStrava] = useState(false);
    const [joinCompetition, setJoinCompetition] = useState(false);

    // Competition the user joined via ?join=<code>; redirected to once onboarding is done.
    const [pendingJoinRedirect, setPendingJoinRedirect] = useState(null);

    // Handle ?join=<code> on its own - independent of the welcome/onboarding flow.
    // This must NOT be gated on ?welcome, otherwise a plain login with ?join=<code>
    // (which does not set ?welcome) would silently drop the join.
    const [joinHandled, setJoinHandled] = useState(false);
    useEffect(() => {
        if (searchTermJoin !== null && joinHandled === false) {
            setJoinHandled(true);
            setJoinCompetition(searchTermJoin);
            searchParams.delete('join');
            setSearchParams(searchParams, {replace: true});
        }
    }, [searchTermJoin, joinHandled])

    // True while a ?join=<code> is still being processed. Derived (not state) so the
    // welcome effect sees it on the very first render, before setJoinCompetition commits.
    const joinPending = searchTermJoin !== null || joinCompetition !== false;

    useEffect(() => {
        if (searchTermWelcome !== null && welcomeMessage === false && linkStrava === false && joinPending === false) {
            // Step 1: Welcome message
            if (welcomeStep === 0) {
                setWelcomeMessage(true);
                setWelcomeStep(1);
            // Step 2: Link Strava
            } else if (welcomeStep === 1) {
                setLinkStrava(true);
                setWelcomeStep(2);
                searchParams.delete('welcome');
                setSearchParams(searchParams, {replace: true});
            }
        }
    }, [welcomeStep, welcomeMessage, linkStrava, joinPending])

    // Redirect to the joined competition once the join modal and the welcome flow
    // (if it was triggered) have both finished.
    useEffect(() => {
        if (pendingJoinRedirect === null) return;
        if (joinPending || welcomeMessage || linkStrava || searchTermWelcome !== null) return;
        setPendingJoinRedirect(null);
        navigate('/competition/' + pendingJoinRedirect);
    }, [pendingJoinRedirect, joinPending, welcomeMessage, linkStrava, searchTermWelcome])


    if (userError) {
        console.log('Error retrieving user:', userError);
        return <PageWrapper additionClasses="h-screen flex items-center justify-center"><ErrorBoxSection
            errorMsg={userError?.status + ' / ' + (userError?.error || userError?.message || userError?.data?.detail)}/></PageWrapper>;
    }

    return (
        <PageWrapper>

            <NavMenu page={'my'}/>

            <div className="container mx-auto p-4">
                <div className="w-full">

                    {
                        (userLoading || workoutsIsLoading) ? (
                            <SectionLoader height={"h-48 mb-4"}/>
                        ) : (userError) ? (
                            <ErrorBoxSection additionalClasses="mb-4"
                                             errorMsg={userError?.status + ' / ' + (userError?.error || userError?.message || userError?.data?.detail)}/>
                        ) : (
                            <WelcomeBox user={user} workouts={workouts} setLinkStrava={setLinkStrava}/>
                        )
                    }

                </div>


                {
                    (userLoading || workoutsIsLoading) ? (
                        <SectionLoader height={"w-full h-80 mb-4"}/>
                    ) : (workoutsError) ? (
                        <ErrorBoxSection additionalClasses="mb-4"
                                         errorMsg={workoutsError?.status + ' / ' + (workoutsError?.error || workoutsError?.message || workoutsError?.data?.detail)}/>
                    ) : (
                        <div
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full flex flex-col xl:flex-row mb-4">
                            <StatsBox workouts={workouts} user={user}/>
                        </div>
                    )
                }


                <div className="w-full flex flex-col xl:flex-row">
                    <div className="order-2 w-full xl:order-1 xl:w-2/3 xl:mr-2">

                        {
                            (userLoading || workoutsIsLoading) ? (
                                <SectionLoader height={"h-80"}/>
                            ) : (workoutsError) ? (
                                <ErrorBoxSection
                                    errorMsg={workoutsError?.status + ' / ' + (workoutsError?.error || workoutsError?.message || workoutsError?.data?.detail)}/>
                            ) : (
                                <WorkoutsBox workouts={workouts} user={user} setLinkStrava={setLinkStrava}/>
                            )
                        }

                    </div>
                    <div className="order-1 w-full xl:order-2 xl:w-1/3 xl:ml-2">

                        {
                            (userLoading || competitionLoading) ? (
                                <SectionLoader/>
                            ) : (competitionError) ? (
                                <ErrorBoxSection additionalClasses="mb-4"
                                                 errorMsg={competitionError?.status + ' / ' + (competitionError?.error || competitionError?.message || competitionError?.data?.detail)}/>
                            ) : (
                                <CompetitionsBox user={user} competitions={competitions} setJoinCompetition={setJoinCompetition}/>
                            )
                        }

                    </div>
                </div>
            </div>

            {welcomeMessage && <HowToScreen setModal={setWelcomeMessage}/>}
            {linkStrava && <LinkStravaScreen setModal={setLinkStrava}/>}
            {joinCompetition && <JoinCompetitionForm setModalState={setJoinCompetition}
                                                     join_code={typeof joinCompetition === 'string' ? joinCompetition : null}
                                                     onJoined={setPendingJoinRedirect}/>}

        </PageWrapper>
    )
}