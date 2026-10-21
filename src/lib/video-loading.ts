/** A failed or empty mirror must not hold up a usable response from another. */
export async function firstUsable<T>(requests: Promise<T>[], usable: (value: T) => boolean): Promise<T | null> {
  try {
    return await Promise.any(requests.map(async (request) => {
      const value = await request;
      if (!usable(value)) throw new Error("No usable response");
      return value;
    }));
  } catch {
    return null;
  }
}

