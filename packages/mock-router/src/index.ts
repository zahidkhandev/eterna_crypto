export interface Quote {
  dex: "RAYDIUM" | "METEORA";
  price: number;
  fee: number;
  amountOut: number;
}

export class MockDexRouter {
  private basePrices: Record<string, number> = {
    "SOL/USDC": 145.5,
    "BTC/USDC": 62000.0,
    "ETH/USDC": 3000.0,
  };

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getQuotes(
    asset: string,
    amount: number,
    side: "BUY" | "SELL"
  ): Promise<Quote[]> {
    const basePrice = this.basePrices[asset] || 100;

    const [raydium, meteora] = await Promise.all([
      this.getQuoteFromDex("RAYDIUM", basePrice, amount, side),
      this.getQuoteFromDex("METEORA", basePrice, amount, side),
    ]);

    return [raydium, meteora];
  }

  private async getQuoteFromDex(
    dex: "RAYDIUM" | "METEORA",
    basePrice: number,
    amount: number,
    side: "BUY" | "SELL"
  ): Promise<Quote> {
    await this.delay(200 + Math.random() * 300);

    const variance = Math.random() * 0.04 - 0.02;
    const price = basePrice * (1 + variance);

    const fee = dex === "RAYDIUM" ? 0.003 : 0.002;

    const amountOut =
      side === "BUY"
        ? (amount / price) * (1 - fee)
        : amount * price * (1 - fee);

    return {
      dex,
      price,
      fee,
      amountOut,
    };
  }

  async executeSwap(
    dex: string,
    asset: string,
    amount: number,
    side: "BUY" | "SELL"
  ) {
    await this.delay(2000 + Math.random() * 1000);

    const txHash =
      "5" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    return {
      success: true,
      txHash: txHash,
      executedPrice: this.basePrices[asset] || 100,
    };
  }
}
