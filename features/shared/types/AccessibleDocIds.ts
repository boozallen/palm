declare const accessibleDocIdsBrand: unique symbol;

export type AccessibleDocIds = ReadonlySet<string> & {
  readonly [accessibleDocIdsBrand]: true;
};
