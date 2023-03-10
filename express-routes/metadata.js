const app = require("express").Router();
const Sentry = require("@sentry/node");
const d3 = import("d3");
const jsdom = require("jsdom");
const svgToMiniDataURI = require("mini-svg-data-uri");
var Prando = require("prando");
const { validateName } = require("../helpers/validate-community-name");
const sha3 = require("web3-utils").sha3;
const { ethers } = require("ethers");
const filter = require("../helpers/filter");

const planet1 = require("../helpers/constants/metadata/planet1");
const planet2 = require("../helpers/constants/metadata/planet2");
const planet3 = require("../helpers/constants/metadata/planet3");
const planet4 = require("../helpers/constants/metadata/planet4");
const planet5 = require("../helpers/constants/metadata/planet5");
const planet6 = require("../helpers/constants/metadata/planet6");
const planet7 = require("../helpers/constants/metadata/planet7");
const planets = [planet1, planet2, planet3, planet4, planet5, planet6, planet7];

const { Metadata } = require("../models/Metadata");

const { JSDOM } = jsdom;

app.get("/domain/:domain", async (req, res) => {
  try {
    const inputDomain = req.params.domain;
    if (
      !inputDomain ||
      inputDomain.length == 0 ||
      inputDomain.length > 32 ||
      inputDomain.toLowerCase() != inputDomain
    ) {
      throw Error("inputDomain invalid!");
    }
    if (inputDomain.includes(".beb")) {
      if (inputDomain.split(".").length != 2) {
        throw Error("inputDomain cannot contain subdomains!");
      }
      const inputDomainSplit = inputDomain.split(".beb");
      if (inputDomainSplit[1].length > 0) {
        throw Error("inputDomain extension incorrect!");
      }
    } else if (inputDomain.includes(".")) {
      throw Error("inputDomain does not have correct extension!");
    }

    validateName(inputDomain);
    const rawDomain = inputDomain.replace(".beb", "");

    const existing = await Metadata.findOne({ uri: sha3(rawDomain) });
    if (existing) {
      return res.json({
        created: false,
        domain: existing.domain,
        uri: existing.uri,
      });
    }

    const metadata = await Metadata.create({
      domain: rawDomain,
      uri: sha3(rawDomain),
    });

    return res.json({
      created: true,
      domain: metadata.domain,
      uri: metadata.uri,
    });
  } catch (e) {
    Sentry.captureException(e);
    console.error(e);
    return res.json({
      code: "500",
      success: false,
      message: e.message,
    });
  }
});

const bebLogo =
  '<svg height="100%" fill="rgb(0,0,0,0.6)" version="1" viewBox="100 -50 1280 1280"></svg>';

app.get("/uri/:uri", async (req, res) => {
  try {
    const uri = req.params.uri;

    if (!uri || uri.length == 0) {
      throw Error("uri invalid!");
    }
    const hexUri = ethers.BigNumber.from(uri).toHexString();
    let metadata = await Metadata.findOne({
      uri: hexUri,
    });
    if (!metadata) {
      metadata = { uri: hexUri, domain: "no_metadata_refresh_beb_domains" };
    }
    const rawDomain = metadata.domain;

    const fakeDom = new JSDOM("<!DOCTYPE html><html><body></body></html>");

    let body = (await d3).select(fakeDom.window.document).select("body");

    let rng = new Prando(rawDomain);

    let hsla = [
      rng.next(300),
      rng.next(300),
      rng.next(300),
      rng.next(300),
      rng.next(300),
      rng.next(300),
      rng.next(300),
    ];
    const index = Math.floor(hsla[0] % 7);

    let gradiantStyle = `background-image:url(${planets[index]});background-size:cover;`;
    let svgContainer = body
      .append("div")
      .attr("class", "container")
      .append("svg")
      .attr("width", 500)
      .attr("height", 500)
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .attr("style", gradiantStyle)
      .html(bebLogo);

    let length = [...rawDomain].length;
    let base = 0.95;
    if (!rawDomain.match(/^[\u0000-\u007f]*$/)) {
      length = 2 * length;
    }

    const dynamicfontsize = parseInt(80 * Math.pow(base, length));

    svgContainer
      .append("text")
      .attr("x", 250)
      .attr("y", 275)
      .attr("font-size", `${dynamicfontsize}px`)
      .attr("font-family", "Helvetica, sans-serif")
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .style("font-weight", "600")
      .style("text-shadow", "2px 2px #111111")
      .text(`${rawDomain}.beb`);

    const svg = body.select(".container").html();
    const image = svgToMiniDataURI(svg);

    let data = {
      name: `${rawDomain}.beb`,
      aliases: [],
      external_url: `https://${rawDomain}.beb.xyz`,
      description: `${rawDomain}.beb was registered on beb.domains!`,
      animation_url: `https://beb.domains/metadata/${uri}`,
      host: "https://protocol.beb.xyz/graphql",
      image,
    };

    if (filter.isProfane(rawDomain) && process.env.MODE !== "self-hosted") {
      data = {
        name: `hidden_domain.beb`,
        description: `This domain is hidden, see beb.xyz/guidelines for more details!`,
      };
    }

    return res.json(data);
  } catch (e) {
    Sentry.captureException(e);
    console.error(e);
    return res.json({
      code: "500",
      success: false,
      message: e.message,
    });
  }
});

module.exports = {
  router: app,
};
