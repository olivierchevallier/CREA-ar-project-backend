const express = require("express");
const axios = require("axios");
const app = express();
const port = 3001;

const SEASON = "2023";
const NB_TEAMS = 14;

const get_teams = () => {
  return sihfAPI
    .get(`/teamstree?season=${SEASON}&language=fr`)
    .then((response) => {
      let teams = [];
      for (let i = 0; i < NB_TEAMS; i++) {
        teams.push(response.data.leagues[0].regions[0].teams[i]);
      }
      return teams;
    });
};

const get_team = (acronym) => {
  return get_teams().then((teams) => {
    const found_team = teams.find((team) => {
      return team.acronym === acronym;
    });
    return found_team;
  });
};

const filter_standings = (standings, team_id) => {
  let teams = [];
  for (let i = 0; i < standings.length; i++) {
    if (standings[i][1]["id"] === team_id) {
      if (i === 0) {
        teams.push(standings[i]);
        teams.push(standings[i + 1]);
        teams.push(standings[i + 2]);
      } else if (i === standings.length - 1) {
        teams.push(standings[i - 2]);
        teams.push(standings[i - 1]);
        teams.push(standings[i]);
      } else {
        teams.push(standings[i - 1]);
        teams.push(standings[i]);
        teams.push(standings[i + 1]);
      }
    }
  }
  return teams;
};

const format_standings = (teams) => {
  let formatted_standings = "";
  for (let team of teams) {
    const pos = team[0];
    const acronym = team[1]["acronym"];
    const win = team[5];
    const lose = team[10];
    const points = team[3];
    formatted_standings += `${pos}\t${acronym} ${
      acronym.length < 4 ? "\t" : ""
    }\t${win}\t${lose}\t${points}\n`;
  }
  return formatted_standings;
};

const clean_api_response = (data) => {
  const jsonStartPos = data.indexOf("{");
  return JSON.parse(data.slice(jsonStartPos, data.length - 2));
};

sihfAPI = axios.create({
  baseURL: "https://data.sihf.ch/statistic/api/cms/",
});

app.get("/", (req, res) => {
  console.log("Express server works");
  res.json({ message: "Express server works" });
});

app.get("/teams", (req, res) => {
  get_teams().then((teams) => {
    res.json(teams);
  });
});

app.get("/teams/:acronym", (req, res) => {
  const acronym = req.params.acronym.toUpperCase();
  get_team(acronym).then((team) => {
    res.send(team.name);
  });
});

app.get("/teams/:acronym/top-scorer", (req, res) => {
  const acronym = req.params.acronym.toUpperCase();
  get_team(acronym)
    .then((team) => {
      const team_id = team.id;
      return sihfAPI.get(
        `cache300?alias=player&searchQuery=1/2023/1/////${team_id}&filterBy=Phase,Team,Position,Licence&filterQuery=/${team_id}&orderByDescending=true&language=fr&callback=topScorers`
      );
    })
    .then((response) => {
      const data = clean_api_response(response.data);
      const player = { name: data.data[0][1], points: data.data[0][7] };
      res.send(`${player.name} (${player.points}pts)`);
    });
});

app.get("/teams/:acronym/standings", (req, res) => {
  const acronym = req.params.acronym.toUpperCase();
  get_team(acronym).then(async (team) => {
    const team_id = team.id;
    const response = await sihfAPI.get(
      `https://data.sihf.ch/statistic/api/cms/cache30?alias=standing&searchQuery=1/2023/1/1&orderBy=rank&filterBy=Phase,ContentType&orderByDescending=false&language=fr&callback=standings`
    );
    const data = clean_api_response(response.data);
    const teams = filter_standings(data.data, team_id);
    res.send(format_standings(teams));
  });
});
app.listen(port, () => {
  console.info(`Listening on port ${port}`);
});
