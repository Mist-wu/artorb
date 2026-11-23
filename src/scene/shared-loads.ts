/** `null` marks a failed load. */
export type Settle<T> = (value: T | null) => void;

export interface SharedLoads<T> {
  /** Calls `settle` with the value for `url`; a URL that is loaded or still loading is not requested again. */
  request(url: string, settle: Settle<T>): void;
  /** Every value loaded so far, once each. */
  loaded(): T[];
}

export function sharedLoads<T>(load: (url: string, settle: Settle<T>) => void): SharedLoads<T> {
  const entries = new Map<string, { value?: T | null; waiting: Settle<T>[] }>();
  return {
    request(url, settle) {
      const known = entries.get(url);
      if (known) {
        if (known.value === undefined) known.waiting.push(settle);
        else settle(known.value);
        return;
      }
      const entry: { value?: T | null; waiting: Settle<T>[] } = { waiting: [settle] };
      entries.set(url, entry);
      load(url, (value) => {
        entry.value = value;
        for (const waiting of entry.waiting.splice(0)) waiting(value);
      });
    },
    loaded() {
      return [...entries.values()].flatMap((entry) => (entry.value == null ? [] : [entry.value]));
    },
  };
}

/** Distinct thumbnail URLs with the indices of the items that show them; recap thumbnails first. */
export function thumbnailGroups(items: readonly { img: string; recap: boolean }[]): [url: string, indices: number[]][] {
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const group = groups.get(item.img);
    if (group) group.push(index);
    else groups.set(item.img, [index]);
  });
  const recap = (indices: number[]) => Number(indices.some((i) => items[i].recap));
  return [...groups].sort(([, a], [, b]) => recap(b) - recap(a));
}
