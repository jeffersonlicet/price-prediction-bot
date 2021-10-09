const { chunk, compact, pick } = require('lodash');
const Big = require('big.js');
const fs = require('fs');
const ora = require('ora');

const useContract = require('./contract');
const strategies = require('./constants/strategies');

const BSC_PROVIDER_URL =
  process.env.BSC_PROVIDER_URL || 'https://bsc-dataseed.binance.org/';

const PKS_CONTRACT_ADDRESS =
  process.env.PKS_CONTRACT_ADDRESS ||
  '0x18b2a687610328590bc8f2e5fedde3b582a49cda';

const fee = 0.03;

const contract = useContract(BSC_PROVIDER_URL, PKS_CONTRACT_ADDRESS);

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHistoricalData() {
  try {
    const configFile = fs.readFileSync('./data.json');
    return JSON.parse(configFile);
  } catch (ex) {
    return null;
  }
}

async function getRoundData(round) {
  try {
    const data = await contract.methods.rounds(round).call();

    const closePriceB = new Big(data.closePrice);
    const lockPriceB = new Big(data.lockPrice);

    const bullAmountB = new Big(data.bullAmount);
    const bearAmountB = new Big(data.bearAmount);
    const totalAmount = new Big(data.totalAmount);

    const bullPayout = totalAmount.div(bullAmountB).round(3).toString();
    const bearPayout = totalAmount.div(bearAmountB).round(3).toString();

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

async function fetchHistoricalData() {
  const spinner = ora('Loading historical data').start();
  const currentRound = await contract.methods.currentEpoch().call();
  spinner.text = 'Loading rounds data';

  const [startRound, endRound] = [100, currentRound - 1];

  const rounds = [];
  const data = [];

  for (let i = startRound; i < endRound; i++) {
    rounds.push(i);
  }

  const chunks = chunk(rounds, 100);
  const groups = chunk(chunks, 10);

  await Promise.all(
    groups.map(async (group) => {
      for (const chunk of group) {
        data.push(
          ...compact(
            await Promise.all(chunk.map((item) => getRoundData(item))),
          ),
        );
      }
    }),
  );

  spinner.succeed('Historical data saved');
  fs.writeFileSync('./data.json', JSON.stringify(data), 'utf8');

  return data;
}

async function runBacktest(settings) {
  const spinner = ora('Running backtest').start();

  let historicalData = getHistoricalData();

  if (!historicalData) {
    historicalData = await fetchHistoricalData();
  }

  const betAmount = new Big(settings.amountPerTrade);
  let capital = new Big(settings.capitalAmount);

  let i = 0;
  let wins = 0;
  let losses = 0;

  for (const round of historicalData) {
    capital = capital.minus(betAmount);

    if (capital.lt(0)) {
      capital = new Big(0);
      break;
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
            .plus(betAmount.times(biggerPayout))
            // Minus fee
            .minus(betAmount.times(biggerPayout).times(fee));
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
            .plus(betAmount.times(minorPayout))
            // Minus fee
            .minus(betAmount.times(minorPayout).times(fee));
        }
        break;
      }

      case settings.strategy === strategies.ALWAYS_BEAR: {
        const bet = 'bear';

        if (round.winner === bet) {
          result = 1;
          capital = capital
            // Add payout
            .plus(betAmount.times(bearPayout))
            // Minus fee
            .minus(betAmount.times(bearPayout).times(fee));
        }

        break;
      }

      case settings.strategy === strategies.ALWAYS_BULL: {
        const bet = 'bull';

        if (round.winner === bet) {
          result = 1;
          capital = capital
            // Add payout
            .plus(betAmount.times(bullPayout))
            // Minus fee
            .minus(betAmount.times(bullPayout).times(fee));
        }

        break;
      }
    }

    if (result) {
      wins++;
    } else {
      losses++;
    }

    i++;

    spinner.frame();
  }

  spinner.succeed('Simulation done');

  const startingAmount = new Big(settings.capitalAmount);

  console.info(`\n Report using ${settings.strategy} strategy \n`);

  console.table({
    initialInvestment: startingAmount.toString(),
    totalRoundPlayed: historicalData.length.toString(),
    wins: wins.toString(),
    losses: losses.toString(),
    realizedPNL: capital
      .minus(startingAmount)
      .abs()
      .times(startingAmount.gt(capital) ? -1 : 1)
      .toString(),
  });
}

module.exports = runBacktest;
