import React, {useEffect, useState} from "react";
import {useJoinTeamMutation} from "../utils/reducers/joinSlice";
import {useAddTeamMutation, useDeleteTeamMutation, useGetTeamsQuery} from "../utils/reducers/teamsSlice";
import {PlusIcon, UsersRound, Trash2} from "lucide-react";
import {BeatLoader} from "react-spinners";
import {FormInput, Modal, inputClasses} from "./basicComponents";


export default function JoinTeamForm({competition, setModalState, user, isOwner}) {

    const {
        data: teams,
        refetch: teamsRefetch,
        error: teamsError,
        isLoading: teamsLoading,
        isSuccess: teamsIsSuccess,
        isFetching: teamsIsFetching,
    } = useGetTeamsQuery();
    const [createTeam, {
        data: createData,
        error: createError,
        isLoading: createIsLoading,
        isSuccess: createIsSuccess
    }] = useAddTeamMutation();
    const [deleteTeam, {
        error: deleteError,
        isLoading: deleteIsLoading,
        isSuccess: deleteIsSuccess
    }] = useDeleteTeamMutation();
    const [joinTeam, {
        data: joinData,
        error: joinError,
        isLoading: joinIsLoading,
        isSuccess: joinIsSuccess
    }] = useJoinTeamMutation();

    const filteredTeams = teams?.filter(item => item.competition === competition?.id);
    const myTeamId = filteredTeams?.find(t => t.user.includes(user?.id))?.id;
    const usedIds = new Set(filteredTeams?.flatMap(team => team?.user));
    const usersWithoutTeams = competition?.user_info?.filter(u => !usedIds.has(u.id));

    async function handleTeamChange(kwargs) {
        await joinTeam(kwargs);
        console.log('Changed teams:', kwargs);
        teamsRefetch();
    };

    async function handleTeamCreate(e) {
        e.preventDefault();
        const result = await createTeam({competition: competition.id, name: e.target.teamName.value});
        console.log('Created new team:', result);
        e.target.reset();
        if (!isOwner) {
            handleTeamChange({team: result.data.id});
        }
    };


    return (
        <Modal landscape={false} setShowModal={setModalState} isLoading={false}>
            {filteredTeams?.map((team, teamidx) => (
                <div key={teamidx} className="p-4">
                    <div className="flex justify-between items-center mb-2 border-b border-t py-2">
                        <h2 className="text-lg font-bold mr-auto">{team.name}</h2>
                        {((!team.my) ? (
                                    <>
                                        {((isOwner && team.user.length === 0) ? (
                                            <button onClick={() => deleteTeam(team.id)}
                                                    className="flex items-center gap-2 px-4 py-2 h-9 mr-2 bg-gray-100 dark:bg-gray-900 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition">
                                                <Trash2 className="w-3 h-3"/>
                                            </button>
                                        ) : null)}
                                        {(!isOwner) && (
                                            <button onClick={() => handleTeamChange({team: team.id})} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition">
                                                <UsersRound className="w-3 h-3"/>
                                                <span className="text-sm break-keep">Join Team</span>
                                            </button>
                                        )}

                                    </>
                                )
                                : <div className="text-sm pr-4">My Team</div>
                        )}
                    </div>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                        {team?.user_info?.map((user, useridx) => (
                            <li key={useridx} className="py-0.5">
                                {user.username}
                                {(isOwner) && <FormInput width="inline-block w-1/3 text-sm" type="select" placeholder={false} selectList={filteredTeams?.map(team => ({value: team.id, label: team.name}))} setValue={(team_id) => handleTeamChange({user: user.id, team: team_id})} value={team.id}/>}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {(usersWithoutTeams?.length > 0) && (
                <div className="p-4">
                    <div className="flex justify-between items-center mb-2 border-b border-t py-2"><h2
                        className="text-lg font-bold mr-auto">Participants without a team</h2>
                        <div className="text-sm pr-4">Add them to your team!</div>
                    </div>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                        {usersWithoutTeams?.map((userI, useridx) => (
                            <li key={useridx} className="py-0.5">
                                {userI.username}
                                {(isOwner) ? (
                                    <FormInput width="inline-block w-1/3 text-sm" type="select" selectList={filteredTeams?.map(team => ({value: team.id, label: team.name}))} setValue={(team_id) => handleTeamChange({user: userI.id, team: team_id})} />
                                ) : (userI.id === user?.id || myTeamId === undefined) ? null : (
                                    <button onClick={() => handleTeamChange({user: userI.id, team: myTeamId})} className="inline-flex items-center gap-2 px-4 ml-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition">
                                        <UsersRound className="w-3 h-3"/>
                                        <span className="text-sm break-keep">Add to my team</span>
                                    </button>
                                )
                                }
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="p-4">
                <h2 className="text-lg font-bold mb-2 border-b border-t py-2 mb-3">Create New Team</h2>
                <form onSubmit={handleTeamCreate} className="flex items-center space-x-2">
                    <input
                        type="text"
                        name="teamName"
                        placeholder="Enter team name"
                        required={true}
                        disabled={teamsLoading}
                        className={inputClasses({disabled: teamsLoading, extra: "flex-1"})}
                    />
                    {(teamsLoading || teamsIsFetching) ? (
                        <BeatLoader color="rgb(209 213 219)"/>
                    ) : (
                        <button type="submit" disabled={teamsLoading} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition">
                            <PlusIcon className="w-3 h-3"/>
                            <span className="text-sm break-keep">
                                {(isOwner) ? 'Create Team': 'Create & Join'}
                            </span>
                        </button>
                    )}
                </form>
            </div>
        </Modal>
    )
}
