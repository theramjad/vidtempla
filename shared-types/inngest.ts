// Test
type HelloWorld = {
    data: {
        message: string;
    };
    user: {
        id: string;
    };
};

/*
AGGREGATOR RELATED
*/

type AggregatorRun = {
};

/*
WEBHOOKS
*/
export type InngestEvents = {
    "test/hello.world": HelloWorld;
    /*
    AGGREGATE
    */
    "aggregator/run": AggregatorRun;
};
