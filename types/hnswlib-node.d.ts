declare module 'hnswlib-node' {
    export class HierarchicalNSW {
        constructor(space: string, dimensions: number);
        initIndex(maxElements: number): void;
        addPoint(vector: number[], label: number): void;
        searchKnn(vector: number[], k: number): { distances: number[]; neighbors: number[] };
        getMaxElements(): number;
        // Add other methods you might use here
    }
} 