# 🔮 PancakeSwap Prediction Bot

### Run simulations(backtesting) and place bets on realtime (soon)

## Roadmap

- ✅ Call contract
- ✅ Auto fetch historical data (and update cache with new rounds)
- ✅ Run simulations (backtesting) over real data
- 🕒 Select range of rounds to run a simulation
- 🕒 Place real-time bets
- Use market variables to place bets

## Screenshots

#### Main options

![](https://i.imgur.com/5kjeoZe.png)

#### Available strategies

![](https://i.imgur.com/tK4jlB2.png)

#### Strategy options

![](https://i.imgur.com/zDySFm2.png)

#### Strategy result

![](https://i.imgur.com/92STiNs.png)

## Strategies

### Bigger Payout

Place bet for the bigger payout (The option where fewer people placed a bet)
If there are more bulls, the payout is going to be less, so we bet bear.

### Minor Payout

Same as above, but the bet is placed where the majority of participants placed a bet.

### Always Bear

Well, always bear, bet that the price is going down.

### Always Bull

Same as above, but bet that the price is going up.

### Trade both directions

Simulates having two wallets with the same amount of BNB, and you can select to add weight to your bets for the minor or bigger payout.

#### Example

Bears payout is x2.5 and Bulls payout is x1.3
You can add weight to the bigger payout thus the resulting positions will be:

```
Bears Bet = betAmount*weight
Bull Bet = betAmount
```

- Given a bet amount of 0.01 BNB
- Adding weight to the bigger payout
- A weight of 2
- Bears payout of x2.5
- Bulls payout of x1.3

#### Bears win

if Bears win you will get `(0.01*2) * 2.5 * (1-3%)` (considering 3% fee).
That's `0.0485 BNB` -> `0.0285` BNB gained

On the other hand, you also have a position for bulls in the other wallet, which is 0.01.

So your net gains are `0.0285-0.01` => `0.0185 BNB`

#### Bulls win

If Bulls win you will get `(0.01) * 1.3 (1-3%)` (considering 3% fee)
That's `0.01261` -> `0.00261` BNB gained

But your bear position is `0.02`, so you will end losing `0.01739 BNB`

## Usage

- You must have Node installed and npm (tested on Node v14.18.0)
- Clone the repository
- Open the terminal on the root of the project
- Run `npm i`
- Run `node index.js`

## Disclaimer

Tested on production, feel free to run in Testnet. Pancake swap prediction contract address and BSc explorer can be modified using the following env vars:

- Create a .env file in the root of the project

```
BSC_PROVIDER_URL=BSC explorer url
PKS_CONTRACT_ADDRESS=Pancake Swap prediction contract address
```

The results/code and settings of this bot are for recreational purposes and are not intended to be used as financial advice.
