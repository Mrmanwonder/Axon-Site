const calls = () => ((window as unknown as { __scanCalls?: Record<string, unknown[][]> }).__scanCalls ??= {});
const record = (name: string) => (...args: unknown[]) => { (calls()[name] ??= []).push(args); };
export const useIngestion = () => ({
  addPaper: record("addPaper"), addLink: record("addLink"), ingestFiles: async (...args: unknown[]) => record("ingestFiles")(...args),
});
