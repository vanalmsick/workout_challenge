import _ from "lodash";

/* Pure data helpers behind the competition page filter - see `applyFilter()`. */

/** Calendar days between a workout and today - the same key space the backend uses for `timeseries`. */
export function daysAgo(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    return Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate())
        - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000);
}

export function timeseriesFromFeed(entries) {
    const series = {};
    for (const entry of entries) {
        const day = daysAgo(entry.workout__start_datetime);
        series[day] = {total: (series[day]?.total || 0) + (entry.points_capped || 0)};
    }
    return series;
}

export function mergeTimeseries(seriesList) {
    const merged = {};
    for (const series of seriesList) {
        for (const [day, value] of Object.entries(series || {})) {
            merged[day] = {total: (merged[day]?.total || 0) + (value.total || 0)};
        }
    }
    return merged;
}

export function rerank(rows, key) {
    let rank = 0;
    let lastValue = null;
    return _.orderBy(rows, [row => row[key] ?? -1], ['desc']).map((row, index) => {
        if (row[key] !== lastValue) {
            rank = index + 1;
            lastValue = row[key];
        }
        return {...row, rank: row[key] == null ? null : rank};
    });
}

/**
 * Narrow `stats` + `feed` down to the active filter.
 *
 * A user/team filter only *selects* server-computed rows, so the points stay exact. A sport filter
 * has no server-side equivalent (only the feed carries `sport_type`), so its totals, ranks and
 * timeseries are re-derived from the feed instead.
 * ponytail: the feed is capped at FEED_MAX_WORKOUTS (500 most recent workouts), so sport-filtered
 * numbers only cover that window - add a `sport_type` query param to /api/stats/ if that bites.
 */
export function applyFilter(stats, feed, filter) {
    if (!filter || !stats || !feed) return {stats, feed};

    const sport = (filter.type === 'sport') ? filter.value : null;
    const sportFeed = sport ? feed.filter(entry => entry.workout__sport_type === sport) : feed;

    const userIds = (filter.type === 'user') ? [Number(filter.value)]
        : (filter.type === 'team') ? (stats.teams?.[filter.value]?.members ?? []).map(member => member.id)
            : _.uniq(sportFeed.map(entry => entry.workout__user));
    const userSet = new Set(userIds);

    const filteredFeed = sportFeed.filter(entry => userSet.has(entry.workout__user));
    const users = _.pickBy(stats.users, (value, key) => userSet.has(Number(key)));
    let teams = _.pickBy(stats.teams, team => team.members.some(member => userSet.has(member.id)));
    let individual = stats.leaderboard.individual.filter(person => userSet.has(person.id));
    let timeseries = {
        all: mergeTimeseries(userIds.map(userId => stats.timeseries.user?.[userId])),
        user: stats.timeseries.user,
        team: stats.timeseries.team,
    };
    let activeMemberCount = userIds.filter(userId => stats.timeseries.user?.[userId]).length;

    if (sport) {
        const pointsByUser = _.mapValues(_.groupBy(filteredFeed, 'workout__user'), rows => _.sumBy(rows, 'points_capped'));
        individual = rerank(individual.map(person => ({...person, total_capped: pointsByUser[person.id] ?? null})), 'total_capped');
        teams = _.keyBy(rerank(Object.values(_.mapValues(teams, team => {
            const members = team.members
                .filter(member => userSet.has(member.id))
                .map(member => ({...member, total_capped: pointsByUser[member.id] ?? null}));
            const activeMembers = members.filter(member => pointsByUser[member.id]).length;
            return {
                ...team,
                members,
                member_count: members.length,
                active_member_count: activeMembers,
                total_capped: _.sumBy(members, member => pointsByUser[member.id] || 0) / Math.max(1, activeMembers),
            };
        })), 'total_capped'), 'id');
        timeseries = {
            all: timeseriesFromFeed(filteredFeed),
            user: _.mapValues(_.groupBy(filteredFeed, 'workout__user'), timeseriesFromFeed),
            team: _.mapValues(teams, team => timeseriesFromFeed(filteredFeed.filter(entry => team.members.some(member => member.id === entry.workout__user)))),
        };
        activeMemberCount = Object.keys(pointsByUser).length;
    }

    return {
        feed: filteredFeed,
        stats: {
            ...stats,
            users,
            teams,
            timeseries,
            competition: {...stats.competition, member_count: userIds.length, active_member_count: activeMemberCount},
            leaderboard: {
                individual,
                team: _.orderBy(Object.values(teams), [team => team.rank ?? Infinity], ['asc']),
            },
        },
    };
}
