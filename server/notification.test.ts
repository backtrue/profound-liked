import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyOwner } from "./_core/notification";

// Mock the fetch function
global.fetch = vi.fn();

describe("Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send notification with correct parameters", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const result = await notifyOwner({
      title: "Test Notification",
      content: "This is a test message",
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("SendNotification"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
        }),
        body: expect.stringContaining("Test Notification"),
      })
    );
  });

  it("should handle notification failure gracefully", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await notifyOwner({
      title: "Test Notification",
      content: "This should fail",
    });

    expect(result).toBe(false);
  });

  it("should handle network errors", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await notifyOwner({
      title: "Test Notification",
      content: "Network error test",
    });

    expect(result).toBe(false);
  });

  it("should format analysis completion notification correctly", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const projectName = "測試專案";
    const successCount = 35;
    const failedCount = 5;
    const totalTests = 40;

    await notifyOwner({
      title: `🎉 分析完成：${projectName}`,
      content: `您的批次分析已經完成！\n\n結果統計：\n- 成功：${successCount} 筆\n- 失敗：${failedCount} 筆\n- 總計：${totalTests} 筆\n\n請前往分析結果頁面查看詳細報告。`,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    
    expect(body.title).toContain("分析完成");
    expect(body.title).toContain(projectName);
    expect(body.content).toContain(`成功：${successCount}`);
    expect(body.content).toContain(`失敗：${failedCount}`);
    expect(body.content).toContain(`總計：${totalTests}`);
  });

  it("should format analysis failure notification correctly", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const projectName = "測試專案";
    const errorMessage = "API rate limit exceeded";

    await notifyOwner({
      title: `⚠️ 分析失敗：${projectName}`,
      content: `您的批次分析執行失敗。\n\n錯誤訊息：${errorMessage}\n\n請查看執行日誌以獲取更多詳細資訊。`,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    
    expect(body.title).toContain("分析失敗");
    expect(body.title).toContain(projectName);
    expect(body.content).toContain(errorMessage);
  });
});
