/* eslint-disable no-constant-condition */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CityName, CorpIndustryName } from "@ns";
import { CorpMaterialName, NS } from "@ns";

type TradePlace = {
    division: string,
    city: CityName,
    price: number,
}

type TradeRoute = {
    buyFrom: TradePlace,
    sellTo: TradePlace,
    material: CorpMaterialName
}

const hiddenMaterials: { [key: string]: CorpMaterialName[] } = {
    "Tobacco": ["Chemicals"]
};

/** @param {NS} ns */
export async function main(ns: NS) {

    if (!ns.corporation.hasCorporation()) {
        ns.tprint("You don't own a coroporation");
        return ns.exit();
    }

    ns.disableLog("sleep");
    while (true) {

        const tradeRoutes: TradeRoute[] = findTradeRoutes(ns);
        tradeRoutes.sort((a, b) => -((a.sellTo.price - a.buyFrom.price) - (b.sellTo.price - b.buyFrom.price)));
        ns.clearLog();
        const maxLenMaterialName = ns.corporation.getConstants().materialNames.map(x => x.length).reduce((a, b) => Math.max(a, b));
        for (const t of tradeRoutes) {
            const priceInc = t.sellTo.price - t.buyFrom.price;
            // const materialBuy = ns.corporation.getMaterial(t.buyFrom.division, t.buyFrom.city, t.material);
            const materialSell = ns.corporation.getMaterial(t.sellTo.division, t.sellTo.city, t.material);
            ns.print(`${t.material.padStart(maxLenMaterialName)}: ${t.buyFrom.division}:${t.buyFrom.city} --> ${t.sellTo.division}:${t.sellTo.city}(${materialSell.actualSellAmount}) gaining $${ns.formatNumber(priceInc)}`);
        }
        ns.tail();
        await ns.sleep(1000);
    }
}

function findTradeRoutes(ns: NS) {
    const tradeRoutes: TradeRoute[] = [];

    const bestPlaceToBuyMaterial = new Map<CorpMaterialName, TradePlace>();
    const bestPlaceToSellMaterial = new Map<CorpMaterialName, TradePlace[]>();
    const materialNames = ns.corporation.getConstants().materialNames;
    const divisions = ns.corporation.getCorporation().divisions;
    for (const d of divisions) {
        const od = ns.corporation.getDivision(d);
        const cities = od.cities;
        for (const c of cities) {
            if (!ns.corporation.hasWarehouse(d, c)) {
                continue;
            }
            const w = ns.corporation.getWarehouse(d, c);
            for (const m of materialNames) {
                if ((hiddenMaterials[od.type] || []).indexOf(m) >= 0) {
                    continue; // Dunno why this happens
                }
                // const om = ns.corporation.getMaterialData(m);
                const omd = ns.corporation.getMaterial(d, c, m);
                const p = omd.marketPrice;
                const bestToBuy = bestPlaceToBuyMaterial.get(m);
                if (bestToBuy == null || bestToBuy.price >= p) {
                    bestPlaceToBuyMaterial.set(m, {
                        price: p,
                        division: d,
                        city: c
                    });
                }
                const bestToSell = bestPlaceToSellMaterial.get(m) || [];
                const i = bestToSell.findIndex((x) => x.city == c && x.division == d);
                const e: TradePlace = { price: p, division: d, city: c };
                if (i < 0) {
                    bestToSell.push(e);
                } else {
                    bestToSell[i] = e;
                }
                bestToSell.sort((a, b) => a.price - b.price);
                bestPlaceToSellMaterial.set(m, bestToSell);
            }
        }
    }

    const minPcDiff = 0.1;
    for (const m of materialNames) {
        const placeToBuy = bestPlaceToBuyMaterial.get(m) || null;
        const lowestPrice = placeToBuy?.price || null;
        if (lowestPrice != null && placeToBuy != null) {
            const placesToSell = (bestPlaceToSellMaterial.get(m) || []).filter(x => x.price > lowestPrice * (1 + minPcDiff));
            for (const placeToSell of placesToSell) {
                tradeRoutes.push({
                    buyFrom: placeToBuy,
                    sellTo: placeToSell,
                    material: m
                });
            }
        }
    }
    return tradeRoutes;
}

