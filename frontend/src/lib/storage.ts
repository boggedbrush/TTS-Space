import Dexie, { Table } from "dexie";
import { HistoryEntry } from "@/lib/types";

class HistoryDatabase extends Dexie {
    history!: Table<HistoryEntry, string>;

    constructor() {
        super("qwen3-tts-studio");
        this.version(1).stores({
            history: "id,timestamp",
        });
    }
}

let db: HistoryDatabase | null = null;

function getDb() {
    if (typeof window === "undefined") return null;
    if (!db) db = new HistoryDatabase();
    return db;
}

export async function saveHistory(entry: HistoryEntry) {
    const database = getDb();
    if (!database) return;
    await database.history.put(entry);
}

export async function getHistory(limit = 40) {
    const database = getDb();
    if (!database) return [];
    return database.history.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function deleteHistory(id: string) {
    const database = getDb();
    if (!database) return;
    await database.history.delete(id);
}

export async function clearHistory() {
    const database = getDb();
    if (!database) return;
    await database.history.clear();
}
