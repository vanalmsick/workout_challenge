import {applyFilter, daysAgo, mergeTimeseries, rerank, timeseriesFromFeed} from "./competitionFilter";

const isoDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
};

// 1 = Ann (team 1), 2 = Bob (team 1), 3 = Cid (team 2)
const stats = () => ({
    competition: {member_count: 3, active_member_count: 3, goals: []},
    users: {
        1: {id: 1, username: "Ann"},
        2: {id: 2, username: "Bob"},
        3: {id: 3, username: "Cid"},
    },
    teams: {
        1: {id: 1, name: "Reds", rank: 1, total_capped: 90, active_member_count: 2, member_count: 2, members: [{id: 1, total_capped: 100}, {id: 2, total_capped: 80}]},
        2: {id: 2, name: "Blues", rank: 2, total_capped: 60, active_member_count: 1, member_count: 1, members: [{id: 3, total_capped: 60}]},
    },
    timeseries: {
        all: {0: {total: 240}},
        user: {1: {0: {total: 100}}, 2: {0: {total: 80}}, 3: {0: {total: 60}}},
        team: {1: {0: {total: 180}}, 2: {0: {total: 60}}},
    },
    leaderboard: {
        individual: [
            {id: 1, username: "Ann", total_capped: 100, rank: 1},
            {id: 2, username: "Bob", total_capped: 80, rank: 2},
            {id: 3, username: "Cid", total_capped: 60, rank: 3},
        ],
        team: [{id: 1, name: "Reds"}, {id: 2, name: "Blues"}],
    },
});

const feed = () => [
    {workout__user: 1, workout__sport_type: "Run", points_capped: 70, workout__start_datetime: isoDaysAgo(0)},
    {workout__user: 1, workout__sport_type: "Ride", points_capped: 30, workout__start_datetime: isoDaysAgo(1)},
    {workout__user: 2, workout__sport_type: "Run", points_capped: 80, workout__start_datetime: isoDaysAgo(1)},
    {workout__user: 3, workout__sport_type: "Ride", points_capped: 60, workout__start_datetime: isoDaysAgo(0)},
];

test("no filter passes stats and feed straight through", () => {
    const s = stats();
    const f = feed();
    expect(applyFilter(s, f, null)).toEqual({stats: s, feed: f});
});

test("user filter keeps that user, their team and only their workouts", () => {
    const {stats: out, feed: outFeed} = applyFilter(stats(), feed(), {type: "user", value: "1"});

    expect(outFeed.map(e => e.workout__user)).toEqual([1, 1]);
    expect(out.leaderboard.individual.map(p => p.username)).toEqual(["Ann"]);
    expect(Object.keys(out.teams)).toEqual(["1"]);
    // server-computed points are only selected, never re-derived, so they stay exact
    expect(out.leaderboard.individual[0].total_capped).toBe(100);
    // "Average" becomes the average over the filtered scope, i.e. Ann alone
    expect(out.timeseries.all).toEqual({0: {total: 100}});
    expect(out.competition.active_member_count).toBe(1);
});

test("team filter keeps the team, its members and their workouts", () => {
    const {stats: out, feed: outFeed} = applyFilter(stats(), feed(), {type: "team", value: "1"});

    expect(outFeed.map(e => e.workout__user).sort()).toEqual([1, 1, 2]);
    expect(out.leaderboard.individual.map(p => p.username)).toEqual(["Ann", "Bob"]);
    expect(out.leaderboard.team.map(t => t.name)).toEqual(["Reds"]);
    expect(out.timeseries.all).toEqual({0: {total: 180}});
});

test("sport filter re-derives points, ranks and the timeseries from the feed", () => {
    const {stats: out, feed: outFeed} = applyFilter(stats(), feed(), {type: "sport", value: "Run"});

    expect(outFeed.every(e => e.workout__sport_type === "Run")).toBe(true);
    // Cid only rode, so neither he nor his team survive the filter
    expect(out.leaderboard.individual.map(p => p.username)).toEqual(["Bob", "Ann"]);
    expect(out.leaderboard.individual.map(p => [p.total_capped, p.rank])).toEqual([[80, 1], [70, 2]]);
    expect(out.leaderboard.team.map(t => t.name)).toEqual(["Reds"]);
    expect(out.leaderboard.team[0].total_capped).toBe(75); // (70 + 80) / 2 active members
    expect(out.timeseries.all).toEqual({0: {total: 70}, 1: {total: 80}});
    expect(out.timeseries.user[1]).toEqual({0: {total: 70}});
});

test("helpers", () => {
    expect(daysAgo(isoDaysAgo(3))).toBe(3);
    expect(timeseriesFromFeed(feed())).toEqual({0: {total: 130}, 1: {total: 110}});
    expect(mergeTimeseries([{0: {total: 1}}, {0: {total: 2}, 5: {total: 4}}])).toEqual({0: {total: 3}, 5: {total: 4}});
    // rows without points rank last and keep a null rank
    expect(rerank([{v: 1}, {v: null}, {v: 9}], "v").map(r => r.rank)).toEqual([1, 2, null]);
});
