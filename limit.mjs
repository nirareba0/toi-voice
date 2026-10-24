// 録音の時間の上限（60秒で自分から止まる）。ブラウザと node --test の両方で読む。
export function createLimit(maxSec, { setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now() } = {}) {
  let startedAt = null;
  let timer = null;
  let stopped = false;
  return {
    start(onLimit) {
      startedAt = now();
      stopped = false;
      timer = setTimer(() => {
        if (stopped) return;
        stopped = true;
        onLimit();
      }, maxSec * 1000);
    },
    // 手で止めたときも、上限で止まったときも、録れた秒数を返す（上限を超えない）
    stop() {
      stopped = true;
      if (timer) clearTimer(timer);
      return this.elapsed();
    },
    elapsed() {
      if (startedAt === null) return 0;
      return Math.min((now() - startedAt) / 1000, maxSec);
    },
    remaining() {
      return Math.max(0, Math.ceil(maxSec - this.elapsed()));
    },
  };
}
