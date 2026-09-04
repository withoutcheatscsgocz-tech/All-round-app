import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { TKey } from '../i18n';

export interface ModuleDef {
  /** Stabilní ID, používá se i jako klíč v nastavení. */
  id: string;
  titleKey: TKey;
  /** Cesta bez lomítka na začátku, např. 'shifts'. */
  path: string;
  icon: string;
  routes: RouteObject[];
  /** Karta na úvodní obrazovce „Dnes". */
  DashboardCard?: ComponentType;
  /** Nižší číslo = dřív ve spodní liště. Prvních 5 je v tab baru, zbytek pod „Více". */
  order: number;
}

const modules: ModuleDef[] = [];

export function registerModule(def: ModuleDef): void {
  if (modules.some((m) => m.id === def.id)) {
    throw new Error(`Modul '${def.id}' už je zaregistrovaný`);
  }
  modules.push(def);
  modules.sort((a, b) => a.order - b.order);
}

export function getModules(): readonly ModuleDef[] {
  return modules;
}

export function getModule(id: string): ModuleDef | undefined {
  return modules.find((m) => m.id === id);
}
