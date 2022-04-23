const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

const bodyParser = require('body-parser');
const {Datastore} = require('@google-cloud/datastore');
// const { response } = require('express');
const datastore = new Datastore({
    projectId: 'hw4-lannersn'
});

app.use(bodyParser.json());

// CONSTANTS
const BOAT = 'Boats';
const LOAD = 'Loads';

const DOMAIN = 'http://localhost:' + PORT

// MODEL FUNCTIONS

// HELPERS 

function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}

function getDate() {
    const date = new Date()
    const dateFormat = `${date.getMonth()}/${date.getDate}/${date.getYear}`;
}

// BOATS

// Create new boat in database
async function post_boat(name, type, length){
    let key = datastore.key(BOAT);

    const new_boat = {"name":name, "type":type, "length":length, "loads": [], "self": ""};
    await datastore.save({"key":key, "data":new_boat});
    const [boat] = await datastore.get(key);
    boat.self = DOMAIN + '/boats/' + boat[Datastore.KEY].id;
    await datastore.update({key:key, data:boat});
    return fromDatastore(boat);
                
}

// Get all boats from database
async function get_all_boats() {
    const q = datastore.createQuery(BOAT);
    const [entities] = await datastore.runQuery(q)
    return entities.map(fromDatastore);
}

// Get a single boat from database by id
async function get_boat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    const [boat] = await datastore.get(key);
    return fromDatastore(boat);
}

// Delete a boat from database by id
function delete_boat(id) {
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.delete(key);    
}

// LOADS

// Create a load in the database
async function post_load(volume, item) {
    try {
        const key = datastore.key(LOAD);
    const dateFormat = getDate();
    const new_load = {"volume": volume, "item": item, "carrier": null, "creation_date": dateFormat, "self": ""};

    await datastore.save({"key":key, "data":new_load});
    const [load] = await datastore.get(key);
    load.self = DOMAIN + '/loads/' + load[Datastore.KEY].id;
    await datastore.update({key:key, data:load});
    return fromDatastore(load);
    } catch (err) {
        console.log(err);
    }
}

// Get all loads from database
async function get_all_loads() {
    const q = datastore.createQuery(LOAD);
    const [entities] = await datastore.runQuery(q)
    return entities.map(fromDatastore);
}

// Get one load from database
async function get_load(id) {
    try {
        const key = datastore.key([LOAD, parseInt(id, 10)]);
        const [load] = await datastore.get(key);
        return fromDatastore(load);
    } catch (err) {
        return false;
    }
}

// Delete a load from database
function delete_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.delete(key);
}

// Routes

// CREATE a boat in database
app.post('/boats', async (req, res) => {
    if (req.body.name && req.body.type && req.body.length) {
        try {
            const boat = await post_boat(req.body.name, req.body.type, req.body.length)
            res.status(201).json( boat );
        } catch (err) {
            res.status(400).json({"Error": "Something went wrong creating the boat. Please try again"});
        }
    } else {
        res.status(400).json({"Error": "The request object is missing at least one of the required attributes"});
    }
});

// READ all boats in database
// TODO IMPLEMENT PAGINATION*******************************************************
app.get('/boats', async (req, res) => {
    const boats = await get_all_boats();
    res.status(200).json(boats);
});

// READ one boat from database
app.get('/boats/:boat_id', async (req, res) => {
    const boat = await get_boat(req.params.boat_id)
    if (boat.length > 0) {
        res.status(200).json(boat);
    } else {
        res.status(404).json({"Error": "No boat with this boat_id exists"});
    }
});

// DELETE a boat from database
app.delete('/boats/:boat_id', async (req, res) => {
    const stuff = await delete_boat(req.params.boat_id)
    if(stuff[0].indexUpdates == 0) {
        res.status(404).json({"Error":"No boat with this boat_id exists"});
    } else {
        res.status(204).end();
    }
});

// CREATE a load
app.post('/loads', async (req, res) => {
    if (req.body.volume && req.body.item) {
        try {
            const load = await post_load(req.body.volume, req.body.item);
            res.status(201).json( load )
        } catch (err) {
            res.status(400).json({"Error": "Something went wrong creating the load. Please try again"})
        }
    } else {
        res.status(400).json({"Error": "The request object is missing at least one of the required attributes"});
    }
})

// READ all loads in database
// TODO IMPLEMENT PAGINATION*******************************************************
app.get('/loads', async (req, res) => {
    const loads = await get_all_loads();
    res.status(200).json(loads);
});

// READ one load from database
app.get('/loads/:load_id', async (req, res) => {
    const load = await get_load(req.params.load_id);
    console.log(load);
    if (load) {
        res.status(200).json(load);
    } else {
        res.status(404).json({"Error": "No load with this load_id exists"});
    }
})

// DELETE a load from database
app.delete('/loads/:load_id', async (req, res) => {
    const stuff = await delete_load(req.params.load_id)
    if(stuff[0].indexUpdates == 0) {
        res.status(404).json({"Error":"No load with this load_id exists"});
    } else {
        res.status(204).end();
    }
})



app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});