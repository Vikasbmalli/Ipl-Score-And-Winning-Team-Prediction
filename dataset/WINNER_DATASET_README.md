# Match-winner dataset

The existing `data.csv` is ball-by-ball data used for score estimation. It does not contain the match-level `winner` target.

For winner prediction, add a separate match-level CSV named `matches.csv` to this folder. A public example is available in the IPL analytics GitHub repository:
https://github.com/avinashyadav16/ipl-analytics

Open `matches_2008-2024.csv`, download the raw CSV, and save it as:
`dataset/matches.csv`

The model code expects columns commonly present in this dataset:
- `date`
- `venue`
- `team1`
- `team2`
- `toss_winner`
- `toss_decision`
- `winner`

Only pre-match information is used. The winner label and post-match fields must never be model inputs.
