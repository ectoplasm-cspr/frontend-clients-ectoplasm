import React, { useState, useEffect } from 'react';
import sdk from 'casper-js-sdk';
import { useDex } from '../contexts/DexContext';
import { useWallet } from '../hooks/useWallet';

const { Deploy } = (sdk as any).default ?? sdk;

interface Props {
    wallet: ReturnType<typeof useWallet>;
    log: (msg: string) => void;
}

export const Swap: React.FC<Props> = ({ wallet, log }) => {
    const { dex, config } = useDex();
    const [amountIn, setAmountIn] = useState('10');
    const [loading, setLoading] = useState(false);
    const [reserves, setReserves] = useState<{r0: bigint, r1: bigint} | null>(null);
    const [slippage, setSlippage] = useState('0.5'); // 0.5% default slippage
    
    // Swap preview state
    const [expectedOutput, setExpectedOutput] = useState<string>('0');
    const [priceImpact, setPriceImpact] = useState<number>(0);
    const [minimumReceived, setMinimumReceived] = useState<string>('0');

    useEffect(() => {
        const fetchReserves = async () => {
             const pairAddr = await dex.getPairAddress(
                 config.tokens.WCSPR.packageHash,
                 config.tokens.ECTO.packageHash
             );

             if (pairAddr) {
                 const res = await dex.getPairReserves(pairAddr);
                 setReserves({
                     r0: res.reserve0,
                     r1: res.reserve1
                 });
             }
        };
       fetchReserves();
    }, [dex, config]);

    // Calculate swap preview whenever input or reserves change
    useEffect(() => {
        if (!reserves || !amountIn || parseFloat(amountIn) <= 0) {
            setExpectedOutput('0');
            setPriceImpact(0);
            setMinimumReceived('0');
            return;
        }

        try {
            const amountInBigInt = BigInt(Math.floor(parseFloat(amountIn) * 10**18));
            
            // Calculate expected output using AMM formula
            const outputAmount = dex.getAmountOut(amountInBigInt, reserves.r0, reserves.r1);
            const outputFormatted = (Number(outputAmount) / 10**18).toFixed(4);
            setExpectedOutput(outputFormatted);

            // Calculate price impact
            // Price impact = (1 - (outputAmount / (inputAmount * currentPrice))) * 100
            const currentPrice = Number(reserves.r1) / Number(reserves.r0);
            const expectedPrice = Number(outputAmount) / Number(amountInBigInt);
            const impact = ((currentPrice - expectedPrice) / currentPrice) * 100;
            setPriceImpact(impact);

            // Calculate minimum received with slippage
            const slippageMultiplier = 1 - (parseFloat(slippage) / 100);
            const minReceived = (parseFloat(outputFormatted) * slippageMultiplier).toFixed(4);
            setMinimumReceived(minReceived);
        } catch (e) {
            console.error('Error calculating swap preview:', e);
        }
    }, [amountIn, reserves, slippage, dex]);

    const handleSwap = async () => {
        if (!wallet.publicKey) return;
        setLoading(true);
        try {
            const decIn = config.tokens.WCSPR.decimals;
            const decOut = config.tokens.ECTO.decimals;
            const amtInBI = BigInt(Math.floor(parseFloat(amountIn) * (10 ** decIn)));
            const amtOutMinBI = BigInt(Math.floor(parseFloat(minimumReceived) * (10 ** decOut)));

            log(`Swapping ${amountIn} WCSPR -> ${expectedOutput} ECTO (min: ${minimumReceived})...`);
            const deploy = dex.makeSwapExactTokensForTokensDeploy(
                amtInBI,
                amtOutMinBI,
                [config.tokens.WCSPR.packageHash, config.tokens.ECTO.packageHash],
                `account-hash-${wallet.publicKey.accountHash().toHex()}`,
                Date.now() + 1800000,
                wallet.publicKey
            );

             log('Requesting signature...');
            const signature = await wallet.sign(deploy);
            log(`Signed! Signature: ${signature.slice(0, 20)}...`);

            // Use JSON payload
            const deployJson = Deploy.toJSON(deploy);
            const approval = { 
                signer: wallet.publicKey.toHex(), 
                signature 
            };
            if (!deployJson.approvals) deployJson.approvals = [];
            deployJson.approvals.push(approval);

            log('Broadcasting JSON...');
            const txHash = await dex.sendDeployRaw(deployJson);
            log(`Swap Sent! Hash: ${txHash}`);
        } catch (e: any) {
             log(`Error: ${e.message}`);
             console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getPriceImpactColor = () => {
        if (priceImpact < 1) return '#4ade80'; // green
        if (priceImpact < 5) return '#fbbf24'; // yellow
        if (priceImpact < 10) return '#fb923c'; // orange
        return '#ef4444'; // red
    };

    return (
        <div className="card">
            <h2>Swap WCSPR to ECTO</h2>
             {reserves && (
                <div style={{fontSize: '0.8rem', marginBottom: '1rem', color: '#aaa'}}>
                    Pool: {(Number(reserves.r0) / 10**18).toFixed(2)} WCSPR / {(Number(reserves.r1) / 10**18).toFixed(2)} ECTO
                </div>
            )}
            
            <div className="form-group">
                <label>WCSPR Amount (In)</label>
                <input 
                    type="number" 
                    value={amountIn} 
                    onChange={e => setAmountIn(e.target.value)} 
                    placeholder="0.0"
                />
            </div>

            {/* Swap Preview */}
            {parseFloat(amountIn) > 0 && reserves && (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.9rem'
                }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                        <span style={{color: '#aaa'}}>Expected Output:</span>
                        <span style={{fontWeight: 'bold'}}>{expectedOutput} ECTO</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                        <span style={{color: '#aaa'}}>Price Impact:</span>
                        <span style={{color: getPriceImpactColor(), fontWeight: 'bold'}}>
                            {priceImpact.toFixed(2)}%
                        </span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                        <span style={{color: '#aaa'}}>Minimum Received:</span>
                        <span>{minimumReceived} ECTO</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span style={{color: '#aaa'}}>Slippage Tolerance:</span>
                        <input 
                            type="number" 
                            value={slippage} 
                            onChange={e => setSlippage(e.target.value)}
                            style={{width: '60px', textAlign: 'right'}}
                            step="0.1"
                        />
                        <span style={{marginLeft: '4px'}}>%</span>
                    </div>
                    
                    {priceImpact >= 5 && (
                        <div style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem',
                            background: priceImpact >= 10 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                            border: `1px solid ${priceImpact >= 10 ? '#ef4444' : '#fb923c'}`,
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            color: priceImpact >= 10 ? '#ef4444' : '#fb923c'
                        }}>
                            ⚠️ {priceImpact >= 10 ? 'High' : 'Moderate'} price impact! Consider reducing your swap amount.
                        </div>
                    )}
                </div>
            )}

            <button onClick={handleSwap} disabled={loading || !reserves || parseFloat(amountIn) <= 0}>
                {loading ? 'Swapping...' : 'Swap'}
            </button>
        </div>
    );
};
