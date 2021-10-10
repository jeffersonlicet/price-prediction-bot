const { chunk, compact, pick, set, sortBy } = require('lodash');
const Big = require('big.js');
const fs = require('fs');
const ora = require('ora');
const Table = require('cli-table');
const cliProgress = require('cli-progress');

const useContract = require('./contract');
const strategies = require('./constants/strategies');
const { error } = require('console');

const BSC_PROVIDER_URL =
  process.env.BSC_PROVIDER_URL || 'https://bsc-dataseed.binance.org/';

const PKS_CONTRACT_ADDRESS =
  process.env.PKS_CONTRACT_ADDRESS ||
  '0x18b2a687610328590bc8f2e5fedde3b582a49cda';

const fee = 0.03;

const contract = useContract(BSC_PROVIDER_URL, PKS_CONTRACT_ADDRESS);

function getHistoricalData() {
  try {
    const configFile = fs.readFileSync('./data.json');
    return JSON.parse(configFile);
  } catch (ex) {
    return null;
  }
}

async function getRoundData(round, bar) {
  try {
    const data = await contract.methods.rounds(round).call();

    const closePriceB = new Big(data.closePrice);
    const lockPriceB = new Big(data.lockPrice);

    const bullAmountB = new Big(data.bullAmount);
    const bearAmountB = new Big(data.bearAmount);
    const totalAmount = new Big(data.totalAmount);

    const bullPayout = totalAmount.div(bullAmountB).round(3).toString();
    const bearPayout = totalAmount.div(bearAmountB).round(3).toString();

    bar.increment();

    return {
      ...pick(data, [
        'epoch',
        'startTimestamp',
        'lockTimestamp',
        'closeTimestamp',
        'lockPrice',
        'closePrice',
        'totalAmount',
        'bullAmount',
        'bearAmount',
        'rewardBaseCalAmount',
        'rewardAmount',
      ]),
      winner: closePriceB.gt(lockPriceB) ? 'bull' : 'bear',
      bullPayout,
      bearPayout,
    };
  } catch (e) {
    return null;
  }
}

async function fetchHistoricalData(oldData, spinner) {
  let data = oldData || [];

  spinner.text = 'Loading historical data';

  const currentRound = parseInt(await contract.methods.currentEpoch().call());

  let startRound = 100;

  if (data && data.length > 0) {
    data = sortBy(data, (round) => parseInt(round.epoch));
    startRound = data[data.length - 1].epoch;

    console.log(
      `\n\n 🔎 Last saved round ${startRound}, current round: ${currentRound}\n`,
    );
  }

  if (currentRound - startRound < 10) {
    spinner.succeed('Using cached data');
    return data;
  }

  const endRound = currentRound - 1;

  const rounds = [];

  for (let i = startRound; i < endRound; i++) {
    rounds.push(i);
  }

  console.log(` 🔎 About to fetch ${rounds.length} rounds\n`);

  const chunks = chunk(rounds, 100);
  const groups = chunk(chunks, 10);

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  spinner.stop();
  bar.start(rounds.length, 0);

  await Promise.all(
    groups.map(async (group) => {
      for (const chunk of group) {
        data.push(
          ...compact(
            await Promise.all(chunk.map((item) => getRoundData(item, bar))),
          ),
        );
      }
    }),
  );

  bar.stop();

  spinner.succeed('Historical data saved');
  fs.writeFileSync('./data.json', JSON.stringify(data), 'utf8');

  return data;
}

async function runBacktest(settings, onDone) {
  const spinner = ora('Running backtest').start();

  let historicalData = getHistoricalData();
  historicalData = await fetchHistoricalData(historicalData, spinner);

  const betAmount = new Big(settings.amountPerTrade);

  let capital = new Big(settings.capitalAmount);
  let capitalB;

  const bothDirections = settings.strategy === strategies.BOTH_DIRECTIONS;

  if (new Big(settings.capitalAmount).lt(betAmount)) {
    error('\nBet amount must be lower than capital amount');
    return onDone();
  }

  // Both directions wallets
  if (bothDirections) {
    capital = new Big(settings.capitalAmount).div(2);
    capitalB = new Big(settings.capitalAmount).div(2);

    if (new Big(settings.capitalAmount).lt(betAmount * 2)) {
      error('\nBet amount must be lower than capital amount for each wallet');
      return onDone();
    }

    spinner.text = `Generating two wallets with ${capital.toString()} BNB each`;
  }

  let wins = 0;
  let losses = 0;

  for (const round of historicalData) {
    if (!bothDirections) {
      capital = capital.minus(betAmount);

      if (capital.lt(0)) {
        capital = new Big(0);
        break;
      }
    } else {
      if (capitalB.lt(betAmount.times(2)) || capital.lt(betAmount.times(2))) {
        break;
      }
    }

    const bullAmount = new Big(round.bullAmount);
    const bearAmount = new Big(round.bearAmount);

    const bullPayout = new Big(round.bullPayout);
    const bearPayout = new Big(round.bearPayout);

    let result = 0;

    spinner.stop();

    switch (true) {
      case settings.strategy === strategies.BIGGER_PAYOUT: {
        const bet = bullAmount.gt(bearAmount) ? 'bull' : 'bear';

        const biggerPayout = bullAmount.gt(bearAmount)
          ? bullPayout
          : bearPayout;

        if (round.winner === bet) {
          result = 1;
          capital = capital
            // Add payout
            .plus(betAmount.times(biggerPayout).times(1 - fee));
        }

        break;
      }

      case settings.strategy === strategies.MINOR_PAYOUT: {
        const bet = bullAmount.gt(bearAmount) ? 'bear' : 'bull';

        const minorPayout = bullPayout.gt(bearPayout) ? bearPayout : bullPayout;

        if (round.winner === bet) {
          result = 1;
          capital = capital
            // Add payout
            .plus(betAmount.times(minorPayout).times(1 - fee));
        }
        break;
      }

      case settings.strategy === strategies.ALWAYS_BEAR: {
        const bet = 'bear';

        if (round.winner === bet) {
          result = 1;
          capital = capital
            // Add payout
            .plus(betAmount.times(bearPayout).times(1 - fee));
        }

        break;
      }

      case settings.strategy === strategies.ALWAYS_BULL: {
        const bet = 'bull';

        if (round.winner === bet) {
          result = 1;
          capital = capital
            // Add payout
            .plus(betAmount.times(bullPayout).times(1 - fee));
        }

        break;
      }

      case settings.strategy === strategies.BOTH_DIRECTIONS: {
        // A bets for bull
        // B bets for bear

        let bullBetMultip;
        let bearBetMultip;

        // Add weight to minor payout
        if (settings.payoutToWeight === 'LESS_PAYOUT') {
          bullBetMultip = bullPayout.lt(bearPayout)
            ? parseInt(settings.weightValue)
            : 1;

          bearBetMultip = bearPayout.lt(bullPayout)
            ? parseInt(settings.weightValue)
            : 1;
        } else {
          // Add weight to greater payout
          bullBetMultip = bullPayout.gt(bearPayout)
            ? parseInt(settings.weightValue)
            : 1;

          bearBetMultip = bearPayout.gt(bullPayout)
            ? parseInt(settings.weightValue)
            : 1;
        }

        const walletABetAmount = betAmount.times(bullBetMultip);
        const walletBBetAmount = betAmount.times(bearBetMultip);

        capital = capital.minus(walletABetAmount);
        capitalB = capitalB.minus(walletBBetAmount);

        if (round.winner === 'bull') {
          capital = capital
            // Add payout
            .plus(walletABetAmount.times(bullPayout).times(1 - fee));
        }

        if (round.winner === 'bear') {
          capitalB = capitalB
            // Add payout
            .plus(walletBBetAmount.times(bearPayout).times(1 - fee));
        }
      }
    }

    if (result) {
      wins++;
    } else {
      losses++;
    }

    spinner.frame();
  }

  spinner.succeed('Simulation done');

  const startingAmount = new Big(settings.capitalAmount);

  let table;

  if (settings.strategy === strategies.BOTH_DIRECTIONS) {
    const resultingCapital = capital.plus(capitalB);
    const startingCapital = new Big(startingAmount);

    const pnl = resultingCapital
      .minus(startingCapital)
      .abs()
      .times(startingCapital.gt(resultingCapital) ? -1 : 1);

    table = new Table({
      style: {
        head: [pnl.gt(0) ? 'green' : 'red'],
      },
      head: [
        'Strategy',
        'Initial invested per wallet',
        'Total invested',
        'Total rounds played',
        'PNL (BNB)',
        'PNL %',
        'Sentiment',
      ],
    });

    table.push([
      settings.strategy,
      startingAmount.div(2).toString(),
      startingCapital.toString(),
      historicalData.length.toString(),
      pnl.toString(),
      pnl.times(100).div(startingAmount),
      pnl.gt(0) ? '🤑' : '😢',
    ]);
  } else {
    const pnl = capital
      .minus(startingAmount)
      .abs()
      .times(startingAmount.gt(capital) ? -1 : 1);

    table = new Table({
      style: {
        head: [pnl.gt(0) ? 'green' : 'red'],
      },
      head: [
        'Strategy',
        'Total invested',
        'Total rounds played',
        'Wins',
        'Losses',
        'PNL (BNB)',
        'PNL %',
        'Sentiment',
      ],
    });

    table.push([
      settings.strategy,
      startingAmount.toString(),
      historicalData.length.toString(),
      wins.toString(),
      losses.toString(),
      pnl.toString(),
      pnl.times(100).div(startingAmount),
      pnl.gt(0) ? '🤑' : '😢',
    ]);
  }

  console.log(table.toString());
  onDone();
}

module.exports = runBacktest;
