/** 現在時刻の Port。テストで時刻を固定するために使う。 */
export interface Clock {
  now(): Date;
}
