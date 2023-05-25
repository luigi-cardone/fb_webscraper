import express from "express";
import Scraper from "./controllers/searchController.js";
const app = express()

const PORT = process.env.PORT || 4000

app.get("/scraper", async (req, res) =>{
    await Scraper()
    res.send("Done")
}
)

app.get("/", (req, res) =>{
    res.send("Render Puppeteer server is up and running")
})

app.listen(PORT, () =>{
    console.log(`Listening on port ${PORT}`)
})