import type { ApiResponse, Source } from "../types";
import { BetterStackClient } from "./client";

export class SourcesAPI {
  private client: BetterStackClient;

  constructor() {
    this.client = new BetterStackClient();
  }

  list(page: number = 1, perPage: number = 50): Promise<ApiResponse<Source[]>> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    return this.client.telemetry<ApiResponse<Source[]>>(`/sources?${params}`);
  }

  async listAll(): Promise<Source[]> {
    const sources: Source[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.list(page, 50);
      sources.push(...response.data);

      if (response.pagination) {
        const { total, page: currentPage, per_page } = response.pagination;
        hasMore = currentPage * per_page < total;
        page++;
      } else {
        hasMore = false;
      }
    }

    return sources;
  }

  async get(sourceId: string): Promise<Source> {
    const response = await this.client.telemetry<ApiResponse<Source>>(`/sources/${sourceId}`);
    return response.data;
  }

  async findByName(name: string): Promise<Source | null> {
    const sources = await this.listAll();
    return sources.find((s) => s.attributes.name === name) || null;
  }
}
