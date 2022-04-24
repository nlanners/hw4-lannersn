const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('../lib/datastore');
const Boats = require('./boats.js');

const datastore = ds.datastore;

router.use(bodyParser.json());

// CONSTANTS
const LOAD = 'Loads';
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const ERROR = 500;

/******************************* MODEL FUNCTIONS ************************************************/

// Create a load in the database
async function post_load(volume, item, date, url) {
    try {
        const key = datastore.key(LOAD);
    const new_load = {"volume": volume, "item": item, "carrier": null, "creation_date": date, "self": ""};

    await datastore.save({"key":key, "data":new_load});
    const [load] = await datastore.get(key);
    load.self = url + load[ds.Datastore.KEY].id;
    await datastore.update({key:key, data:load});
    return ds.fromDatastore(load);
    } catch (err) {
        console.log(err);
    }
}

// Get all loads from database
async function get_all_loads(req) {
    try {
        let q = datastore.createQuery(LOAD).limit(3);
        const results = {};
        if (Object.keys(req.query).includes('cursor')) {
            q = q.start(req.query.cursor);
        }
        const entities = await datastore.runQuery(q)
        results.loads = entities[0].map(ds.fromDatastore);
        if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next = ds.createURL(req) + '?cursor=' + entities[1].endCursor;
        }
        return results;
    } catch (err) {
        console.log(err);
    }
}

// Get one load from database
async function get_load(id) {
    try {
        const key = datastore.key([LOAD, parseInt(id, 10)]);
        const [load] = await datastore.get(key);
        return ds.fromDatastore(load);
    } catch (err) {
        return false;
    }
}

// Delete a load from database
async function delete_load(id) {
    try {
        const load = await get_load(id);

        if (!load) {
            return NOT_FOUND;
        }

        if (load.carrier != null) {
            let boat = await Boats.get_boat(load.carrier.id);
            let boatLoads = boat.loads.filter( value => value.id != load.id);
            
            boat.loads = boatLoads;
            await datastore.update(ds.createEntity(boat));
        }
        return await datastore.delete(load[ds.Datastore.KEY]);

    } catch (err) {
        console.log(err);
    }
}


/******************************* CONTROLLERS ********************************************/

// CREATE a load
router.post('/', async (req, res) => {
    if (req.body.volume && req.body.item && req.body.creation_date) {
        try {
            const url = ds.createURL(req);
            const load = await post_load(req.body.volume, req.body.item, req.body.creation_date, url);
            res.status(CREATED).json( load )
        } catch (err) {
            res.status(BAD_REQUEST).json({"Error": "Something went wrong creating the load. Please try again"})
        }
    } else {
        res.status(BAD_REQUEST).json({"Error": "The request object is missing at least one of the required attributes"});
    }
});

// READ all loads in database
// TODO IMPLEMENT PAGINATION*******************************************************
router.get('/', async (req, res) => {

    try {
        const loads = await get_all_loads(req);
        res.status(OK).json(loads);
    } catch (err) {
        console.log(err);
    }
});

// READ one load from database
router.get('/:load_id', async (req, res) => {
    const load = await get_load(req.params.load_id);
    if (load) {
        res.status(OK).json(load);
    } else {
        res.status(NOT_FOUND).json({"Error": "No load with this load_id exists"});
    }
});

// DELETE a load from database
router.delete('/:load_id', async (req, res) => {
    try {
        const status = await delete_load(req.params.load_id)
        if(status == NOT_FOUND) {
            res.status(NOT_FOUND).json({"Error":"No load with this load_id exists"});
        } else {
            res.status(NO_CONTENT).end();
        }
    } catch (err) {
        console.log(err);
    }
});


module.exports = router;
module.exports.get_load = get_load;