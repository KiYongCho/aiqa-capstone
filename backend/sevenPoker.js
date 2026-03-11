const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const HAND_NAMES = [
  "하이카드",
  "원페어",
  "투페어",
  "트리플",
  "스트레이트",
  "플러시",
  "풀하우스",
  "포카드",
  "스트레이트 플러시",
];

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank, i) => ({ rank, suit, value: i + 2 }))
  );
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function combinations(arr, choose) {
  const result = [];

  function dfs(start, picked) {
    if (picked.length === choose) {
      result.push([...picked]);
      return;
    }

    for (let i = start; i < arr.length; i += 1) {
      picked.push(arr[i]);
      dfs(i + 1, picked);
      picked.pop();
    }
  }

  dfs(0, []);
  return result;
}

function rankHistogram(cards) {
  const map = new Map();
  cards.forEach((card) => map.set(card.value, (map.get(card.value) || 0) + 1));
  return [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
}

function getStraightHigh(valuesDesc) {
  const uniq = [...new Set(valuesDesc)].sort((a, b) => b - a);
  if (uniq[0] === 14) uniq.push(1);

  let run = 1;
  for (let i = 1; i < uniq.length; i += 1) {
    if (uniq[i - 1] - uniq[i] === 1) {
      run += 1;
      if (run >= 5) {
        return uniq[i - 4] === 1 ? 5 : uniq[i - 4];
      }
    } else {
      run = 1;
    }
  }
  return null;
}

function compareScore(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i += 1) {
    const diff = (a.kickers[i] || 0) - (b.kickers[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function evaluateFiveCardHand(cards) {
  const valuesDesc = cards.map((c) => c.value).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const straightHigh = getStraightHigh(valuesDesc);
  const groups = rankHistogram(cards);

  if (isFlush && straightHigh) {
    return { rank: 8, kickers: [straightHigh], name: HAND_NAMES[8] };
  }

  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return { rank: 7, kickers: [quad, kicker], name: HAND_NAMES[7] };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 6, kickers: [groups[0][0], groups[1][0]], name: HAND_NAMES[6] };
  }

  if (isFlush) {
    return { rank: 5, kickers: valuesDesc, name: HAND_NAMES[5] };
  }

  if (straightHigh) {
    return { rank: 4, kickers: [straightHigh], name: HAND_NAMES[4] };
  }

  if (groups[0][1] === 3) {
    const triple = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return { rank: 3, kickers: [triple, ...kickers], name: HAND_NAMES[3] };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { rank: 2, kickers: [highPair, lowPair, kicker], name: HAND_NAMES[2] };
  }

  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return { rank: 1, kickers: [pair, ...kickers], name: HAND_NAMES[1] };
  }

  return { rank: 0, kickers: valuesDesc, name: HAND_NAMES[0] };
}

function evaluateBestHand(cards7) {
  const allFiveCardHands = combinations(cards7, 5);
  return allFiveCardHands.reduce((best, hand) => {
    const current = evaluateFiveCardHand(hand);
    if (!best || compareScore(current, best) > 0) {
      return { ...current, cards: hand };
    }
    return best;
  }, null);
}

function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

function playSevenPoker(playerCount = 4) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) {
    throw new Error("playerCount는 2~8 사이 정수여야 합니다.");
  }

  const deck = shuffle(createDeck());

  const players = Array.from({ length: playerCount }, (_, i) => ({
    name: `Player ${i + 1}`,
    holeCards: [deck.pop(), deck.pop()],
  }));

  const communityCards = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

  const results = players.map((player) => {
    const sevenCards = [...player.holeCards, ...communityCards];
    const best = evaluateBestHand(sevenCards);
    return {
      ...player,
      best,
    };
  });

  const bestScore = results.reduce((max, p) => (compareScore(p.best, max) > 0 ? p.best : max), results[0].best);

  const winners = results.filter((p) => compareScore(p.best, bestScore) === 0);

  return {
    communityCards,
    players: results,
    winners,
  };
}

if (require.main === module) {
  const game = playSevenPoker(4);

  console.log("커뮤니티 카드:", game.communityCards.map(formatCard).join(" "));
  console.log("\n플레이어 결과:");
  game.players.forEach((p) => {
    console.log(
      `- ${p.name} | 홀카드: ${p.holeCards.map(formatCard).join(" ")} | 족보: ${p.best.name} (${p.best.cards
        .map(formatCard)
        .join(" ")})`
    );
  });

  console.log("\n우승자:", game.winners.map((w) => w.name).join(", "));
}

module.exports = {
  playSevenPoker,
  evaluateBestHand,
  evaluateFiveCardHand,
  compareScore,
  createDeck,
  shuffle,
};
