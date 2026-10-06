import { Fragment, type ReactNode } from "react";

// Komórki wiersza dla SortableTable. Każda dostaje klucz, bo lista elementów przekazywana
// z serwera do komponentu klienckiego musi mieć klucze (inaczej React ostrzega).
export function cells(...nodes: ReactNode[]): ReactNode[] {
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}
