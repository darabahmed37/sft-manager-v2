export class Config {
  private p = new Map<string, string>();

  set(key: string, value: string | null) {
    this.p.set(key, (value || '').trim());
  }

  get(key: string, def = ''): string {
    return this.p.get(key) || def;
  }

  getBool(key: string, def: boolean): boolean {
    const val = this.p.get(key);
    if (val === undefined) return def;
    return val === 'true';
  }
}
export default Config;
