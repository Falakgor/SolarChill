const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
    try {
        await client.connect();

        console.log("MongoDB connected successfully!");

        const database = client.db("cold_storage");
        const sensorData = database.collection("sensor_data");


        // ==================================================
        // HOME ROUTE
        // ==================================================

        app.get("/", (req, res) => {
            res.send("Smart Cold Storage API is running!");
        });


        // ==================================================
        // RECEIVE SENSOR DATA
        // ==================================================

        app.post("/api/sensor-data", async (req, res) => {

            try {

                const {
                    temperature,
                    status,
                    fanSpeed,
                    pwm
                } = req.body;


                // ------------------------------------------
                // Basic validation
                // ------------------------------------------

                if (
                    temperature === undefined ||
                    status === undefined ||
                    fanSpeed === undefined ||
                    pwm === undefined
                ) {

                    return res.status(400).json({
                        message: "Missing sensor data"
                    });

                }


                // ------------------------------------------
                // Convert values
                // ------------------------------------------

                const temp = Number(temperature);
                const fan = Number(fanSpeed);
                const pwmValue = Number(pwm);


                // ------------------------------------------
                // Validate numeric values
                // ------------------------------------------

                if (
                    !Number.isFinite(temp) ||
                    !Number.isFinite(fan) ||
                    !Number.isFinite(pwmValue)
                ) {

                    return res.status(400).json({
                        message: "Invalid sensor data"
                    });

                }


                // ==================================================
                // ALERT LOGIC
                // ==================================================

                let alertStatus;
                let alert;
                let alertMessage;


                // ------------------------------------------
                // NORMAL
                // Below 22°C
                // No alert
                // ------------------------------------------

                if (temp < 22) {

                    alertStatus = "Normal";

                    alert = false;

                    alertMessage =
                        "Temperature is within the safe range.";

                }


                // ------------------------------------------
                // WARNING
                // 22°C to 26°C
                // ------------------------------------------

                else if (temp >= 22 && temp <= 26) {

                    alertStatus = "Warning";

                    alert = true;

                    alertMessage =
                        "Temperature is above the normal range.";

                }


                // ------------------------------------------
                // CRITICAL
                // Above 26°C
                // ------------------------------------------

                else {

                    alertStatus = "Critical";

                    alert = true;

                    alertMessage =
                        "Critical temperature detected! Immediate attention required.";

                }


                // ==================================================
                // DATA OBJECT
                // ==================================================

                const data = {

                    temperature: temp,

                    // Status received from NodeMCU
                    status: String(status),

                    fanSpeed: fan,

                    pwm: pwmValue,

                    // Alert information
                    alertStatus: alertStatus,

                    alert: alert,

                    alertMessage: alertMessage,

                    timestamp: new Date()

                };


                // ==================================================
                // SAVE TO MONGODB
                // ==================================================

                const result =
                    await sensorData.insertOne(data);


                // ==================================================
                // RESPONSE
                // ==================================================

                res.status(201).json({

                    message:
                        "Sensor data saved successfully!",

                    id: result.insertedId,

                    temperature: temp,

                    alertStatus: alertStatus,

                    alert: alert,

                    alertMessage: alertMessage

                });

            }

            catch (error) {

                console.error(
                    "Error saving sensor data:",
                    error
                );

                res.status(500).json({

                    message:
                        "Failed to save sensor data"

                });

            }

        });


        // ==================================================
        // GET LATEST SENSOR DATA
        // ==================================================

        app.get("/api/sensor-data/latest", async (req, res) => {

            try {

                const latestData =
                    await sensorData
                        .findOne(
                            {},
                            {
                                sort: {
                                    timestamp: -1
                                }
                            }
                        );


                // ------------------------------------------
                // No data available
                // ------------------------------------------

                if (!latestData) {

                    return res.status(404).json({

                        message: "No sensor data available"

                    });

                }


                // ------------------------------------------
                // Send latest data
                // ------------------------------------------

                res.status(200).json(latestData);

            }

            catch (error) {

                console.error(
                    "Error fetching latest sensor data:",
                    error
                );

                res.status(500).json({

                    message:
                        "Failed to fetch latest sensor data"

                });

            }

        });


        // ==================================================
        // GET SENSOR DATA HISTORY
        // ==================================================

        app.get("/api/sensor-data", async (req, res) => {

            try {

                const data =
                    await sensorData
                        .find({})
                        .sort({
                            timestamp: -1
                        })
                        .limit(100)
                        .toArray();


                // ------------------------------------------
                // Send sensor history
                // ------------------------------------------

                res.status(200).json(data);

            }

            catch (error) {

                console.error(
                    "Error fetching sensor data:",
                    error
                );

                res.status(500).json({

                    message:
                        "Failed to fetch sensor data"

                });

            }

        });


        // ==================================================
        // START SERVER
        // ==================================================

        const PORT =
            process.env.PORT || 3000;


        app.listen(PORT, () => {

            console.log(
                `Server running on port ${PORT}`
            );

        });

    }

    catch (error) {

        console.error(
            "MongoDB connection failed:",
            error
        );

    }

}


startServer();
