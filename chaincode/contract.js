"use strict";

// Importing the necessary packages
const { Contract } = require("fabric-contract-api");
const ClientIdentity = require("fabric-shim").ClientIdentity;
const util = require("util");

class PharmanetContract extends Contract {
  constructor() {
    super("org.pharma-network.pharmanet");
  }

  async instantiate(ctx) {
    console.log("Pharmanet Smart Contract Instantiated Super successful");
  }
  /*
  Used to register the company with the network
  @params companyCRN - unique CRN for each company
          companyName - Name of the company
          location - Location of the company
          organisationRole - Has 4 values (Manufacturer, Distributor, Retailer, Transporter)
  @return companyObject
  */
  async registerCompany(ctx, companyCRN, companyName, location, organisationRole) {
    console.log("Registering the company " + companyName);

    let cid = new ClientIdentity(ctx.stub);
    let mspID = cid.getMSPID();

    console.log("MSPID of the transaction initiator is=> " + mspID);

    if ("consumerMSP" !== mspID) {
      const companyID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.company", [companyCRN, companyName]);

      if (
        organisationRole !== "Manufacturer" &&
        organisationRole !== "Distributor" &&
        organisationRole !== "Retailer" &&
        organisationRole !== "Transporter"
      ) {
        return "Invalid Organisation Role";
      } else {
        let hierarchyKey;
        if (organisationRole === "Manufacturer") {
          hierarchyKey = "1";
        } else if (organisationRole === "Distributor") {
          hierarchyKey = "2";
        } else if (organisationRole === "Retailer") {
          hierarchyKey = "3";
        } else if (organisationRole === "Transporter") {
          hierarchyKey = "";
        }

        let companyObject = {
          companyID: companyID,
          name: companyName,
          location: location,
          organisationRole: organisationRole,
          hierarchyKey: hierarchyKey,
          createdAt: new Date(),
        };

        let companyDataBuffer = Buffer.from(JSON.stringify(companyObject));
        await ctx.stub.putState(companyID, companyDataBuffer);

        return companyObject;
      }
    }
  }
/*
  Used by organisation registered as a 'manufacturer' to register new drug on the ledger
  @params drugName - Name of the drug
          serialNo - serial number of the drug
          mfgDate - Date of manufacturer of the drug
          expDate - Expiry date of the drug
          companyCRN - Unique CRN number of the manufacturer
  @returns drugObject that's saved to the ledger
  
  */
 async addDrug(ctx, drugName, serialNo, mfgDate, expDate, companyCRN) {
    let companyResultsIterator = await ctx.stub.getStateByPartialCompositeKey("org.pharma-network.pharmanet.company", [
      companyCRN,
    ]);
    var manufacturerFound = false;
    while (!manufacturerFound) {
      let responseRange = await companyResultsIterator.next();

      if (!responseRange || !responseRange.value || !responseRange.value.key) {
        return "Invalid companyCRN";
      }

      manufacturerFound = true;
      let objectType;
      let attributes;
      ({ objectType, attributes } = await ctx.stub.splitCompositeKey(responseRange.value.key));

      let returnedCompanyName = attributes[1];
      let returnedCompanyCRN = attributes[0];

      const generateKeyDrugOwner = await ctx.stub.createCompositeKey("org.pharma-network.pharmanet.company", [
        returnedCompanyCRN,
        returnedCompanyName,
      ]);

      let cid = new ClientIdentity(ctx.stub);
      let mspID = cid.getMSPID();

      if ("manufacturerMSP" === mspID) {
        const productID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.drug", [drugName, serialNo]);

        let drugObject = {
          productID: productID,
          name: drugName,
          manufacturer: generateKeyDrugOwner,
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          owner: generateKeyDrugOwner,
          shipment: "",
        };

        let drugDataBuffer = Buffer.from(JSON.stringify(drugObject));
        await ctx.stub.putState(productID, drugDataBuffer);
        return drugObject;
      } else {
        return "No one can add a drug but Manufacturer.";
      }
    }
  }

  async createPO(ctx, buyerCRN, sellerCRN, drugName, quantity) {
    let cid = new ClientIdentity(ctx.stub);

    let mspID = "distributorMSP";
    console.log(
      "buyerCRN is=>" + buyerCRN + "sellerCRN=> " + sellerCRN + "drugName=> " + drugName + "quantity=>" + quantity
    );
    if ("retailerMSP" !== mspID && "distributorMSP" !== mspID) {
      return "Sorry! Only Distributor and Retailer can create a purchase request!";
    } else {
      let sellerCRNResultsIterator = await ctx.stub.getStateByPartialCompositeKey(
        "org.pharma-network.pharmanet.company",
        [sellerCRN]
      );

      var sellerCRNFound = false;
      while (!sellerCRNFound) {
        let sellerCRNResponseRange = await sellerCRNResultsIterator.next();

        if (!sellerCRNResponseRange || !sellerCRNResponseRange || !sellerCRNResponseRange.value.key) {
          return "Invalid Seller CompanyCRN";
        } else {
          sellerCRNFound = true;
          let objectType;
          let attributes;
          ({ objectType, attributes } = await ctx.stub.splitCompositeKey(sellerCRNResponseRange.value.key));

          let returnedSellerCompanyName = attributes[0];
          let returnedSellerCompanyCRN = attributes[1];

          console.info(
            util.format(
              "- found a company from namespace:%s companyname:%s companycrn:%s\n",
              objectType,
              returnedSellerCompanyName,
              returnedSellerCompanyCRN
            )
          );

          var generateSellerCompanyID = await ctx.stub.createCompositeKey("org.pharma-network.pharmanet.company", [
            returnedSellerCompanyName,
            returnedSellerCompanyCRN,
          ]);

          var sellerCompanyBuffer = await ctx.stub.getState(generateSellerCompanyID).catch((err) => console.log(err));
          console.log("Seller Company Details are=> " + sellerCompanyBuffer.toString());
        }
      }

      let buyerCRNResultsIterator = await ctx.stub.getStateByPartialCompositeKey(
        "org.pharma-network.pharmanet.company",
        [buyerCRN]
      );

      var buyerCRNFound = false;
      while (!buyerCRNFound) {
        let buyerCRNResponseRange = await buyerCRNResultsIterator.next();

        if (!buyerCRNResponseRange || !buyerCRNResponseRange || !buyerCRNResponseRange.value.key) {
          return "Invalid Seller CompanyCRN";
        } else {
          buyerCRNFound = true;
          let objectType;
          let attributes;
          ({ objectType, attributes } = await ctx.stub.splitCompositeKey(buyerCRNResponseRange.value.key));

          let returnedBuyerCompanyName = attributes[0];
          let returnedBuyerCompanyCRN = attributes[1];

          console.info(
            util.format(
              "- found a company from namespace:%s companyname:%s companycrn:%s\n",
              objectType,
              returnedBuyerCompanyName,
              returnedBuyerCompanyCRN
            )
          );

          var generateBuyerCompanyID = await ctx.stub.createCompositeKey("org.pharma-network.pharmanet.company", [
            returnedBuyerCompanyName,
            returnedBuyerCompanyCRN,
          ]);

          var buyerCompanyBuffer = await ctx.stub.getState(generateBuyerCompanyID).catch((err) => console.log(err));
          console.log("Buyer Company Details are=> " + buyerCompanyBuffer.toString());
        }
      }
    }

    console.log("I am the Buyer=> " + buyerCompanyBuffer);
    console.log("I am the seller=> " + sellerCompanyBuffer);
    let buyerData = JSON.parse(buyerCompanyBuffer.toString());
    console.log("buyerData=> " + buyerData);
    let sellerData = JSON.parse(sellerCompanyBuffer.toString());
    console.log("sellerData=> " + sellerData.organisationRole);


    if (buyerData.organisationRole === "Retailer") {
      console.log("Retailer can purchase only from Distributor");
      if (sellerData.organisationRole === "Distributor") {
        console.log("All Good, Create a purchase request");
        const poID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.productOrders", [buyerCRN, drugName]);

        let purchaseOrderObject = {
          poID: poID,
          drugName: drugName,
          quantity: quantity,
          buyer: generateBuyerCompanyID,
          seller: generateSellerCompanyID,
        };

        console.log("purchaseOrderObject created is==> " + purchaseOrderObject);

        let purchaseOrderDataBuffer = Buffer.from(JSON.stringify(purchaseOrderObject));
        await ctx.stub.putState(poID, purchaseOrderDataBuffer);
        return purchaseOrderObject;
      } else {
        let returnValue = "Sorry!" + buyerData.organisationRole + " can't purchase from " + sellerData.organisationRole;
        console.log("Sorry!" + buyerData.organisationRole + " can't purchase from " + sellerData.organisationRole);
        return returnValue;
      }
    } else if (buyerData.organisationRole === "Distributor") {
      console.log("Distributor can purchase only from Manufacturer");
      if (sellerData.organisationRole === "Manufacturer") {
        console.log("All Good, Create a purchase request");
        const poID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.productOrders", [buyerCRN, drugName]);

        let purchaseOrderObject = {
          poID: poID,
          drugName: drugName,
          quantity: quantity,
          buyer: generateBuyerCompanyID,
          seller: generateSellerCompanyID,
        };

        console.log("purchaseOrderObject created is==> " + purchaseOrderObject);

        let purchaseOrderDataBuffer = Buffer.from(JSON.stringify(purchaseOrderObject));
        await ctx.stub.putState(poID, purchaseOrderDataBuffer);
        return purchaseOrderObject;
      } else {
        let returnValue = "Sorry!" + buyerData.organisationRole + " can't purchase from " + sellerData.organisationRole;
        console.log("Sorry!" + buyerData.organisationRole + " can't purchase from " + sellerData.organisationRole);
        return returnValue;
      }
    } else {
      console.log(buyerData.organisationRole + " can't purchase from " + sellerData.organisationRole);
      let returnValue = buyerData.organisationRole + " can't purchase from " + sellerData.organisationRole;
      return returnValue;
    }
  }
/*
  Seller invokes to transport the consignment via a transporter corresponding to each PO.
  @params buyerCRN - Drug's buyer CRN
          drugName - Name of the drug
          listOfAssets - list of drug
          transporterCRN - CRN of the transporter who delivers the drug
  @returns shipmentObject - in response to the Purchase order
  */
  async createShipment(ctx, buyerCRN, drugName, listOfAssets, transporterCRN) {
    let listFromCommandLine = listOfAssets.split(",");
    let listOfAssetsLength = listFromCommandLine.length;

    //Get the PO associated with the buyerCRN
    let buyerCRNResultsIterator = await ctx.stub.getStateByPartialCompositeKey(
      "org.pharma-network.pharmanet.productOrders",
      [buyerCRN]
    );

    var buyerCRNFound = false;
    while (!buyerCRNFound) {
      let buyerCRNResponseRange = await buyerCRNResultsIterator.next();

      if (!buyerCRNResponseRange || !buyerCRNResponseRange || !buyerCRNResponseRange.value.key) {
        return "Invalid Buyer CompanyCRN";
      } else {
        buyerCRNFound = true;
        let objectType;
        let attributes;
        ({ objectType, attributes } = await ctx.stub.splitCompositeKey(buyerCRNResponseRange.value.key));

        let returnedBuyerCRN = attributes[0];
        let returnedBuyerDrugName = attributes[1];

        let generatePOID = await ctx.stub.createCompositeKey("org.pharma-network.pharmanet.productOrders", [
          returnedBuyerCRN,
          returnedBuyerDrugName,
        ]);

        let buyerPurchaseBuffer = await ctx.stub.getState(generatePOID).catch((err) => console.log(err));
        let parsedPurchaseOrder = JSON.parse(buyerPurchaseBuffer.toString());

        if (listOfAssetsLength == parsedPurchaseOrder.quantity) {
          var validDrugId = true;
          var listOfCompositeKeysForDrugs = [];
          for (let i = 0; i <= listFromCommandLine.length - 1; i++) {
            if (validDrugId) {
              let serialnumberOfTheDrug = listFromCommandLine[i];
              const productDrugID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.drug", [
                drugName,
                serialnumberOfTheDrug,
              ]);

              let drugDetailsBuffer = await ctx.stub.getState(productDrugID).catch((err) => console.log(err));
              try {
                let json = JSON.parse(drugDetailsBuffer.toString());
                validDrugId = true;
                listOfCompositeKeysForDrugs.push(productDrugID);
              } catch (err) {
                validDrugId = false;
                return "Sorry the drug is not registered with the network";
              }
            }
          }
          if (validDrugId) {
            const shipmentID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.shipment", [
              buyerCRN,
              drugName,
            ]);

            let transporterCRNResultsIterator = await ctx.stub.getStateByPartialCompositeKey(
              "org.pharma-network.pharmanet.company",
              [transporterCRN]
            );

            var transporterCRNFound = false;
            while (!transporterCRNFound) {
              let transporterCRNResponseRange = await transporterCRNResultsIterator.next();

              if (
                !transporterCRNResponseRange ||
                !transporterCRNResponseRange ||
                !transporterCRNResponseRange.value.key
              ) {
                return "Invalid transporterCRN";
              } else {
                transporterCRNFound = true;
                let objectType;
                let attributes;
                ({ objectType, attributes } = await ctx.stub.splitCompositeKey(transporterCRNResponseRange.value.key));

                let returnedTransporterCompanyName = attributes[1];
                let returnedTransporterCompanyCRN = attributes[0];

                console.log("returnedTransporterCompanyName=> " + returnedTransporterCompanyName);
                console.log("returnedTransporterCompanyCRN=> " + returnedTransporterCompanyCRN);

                var generateTransporterCompanyID = await ctx.stub.createCompositeKey(
                  "org.pharma-network.pharmanet.company",
                  [returnedTransporterCompanyCRN, returnedTransporterCompanyName]
                );

                console.log("Transporter composite key created=> " + generateTransporterCompanyID);
              }
            }

            let shipmentObject = {
              shipmentID: shipmentID,
              creator: ctx.clientIdentity.getID(),
              assets: listOfCompositeKeysForDrugs,
              transporter: generateTransporterCompanyID,
              status: "in-transit",
            };

            let shipmentDataBuffer = Buffer.from(JSON.stringify(shipmentObject));
            await ctx.stub.putState(shipmentID, shipmentDataBuffer);


            for (let i = 0; i <= listOfCompositeKeysForDrugs.length - 1; i++) {
              let drugCompositeKey = listOfCompositeKeysForDrugs[i];
              let drugDataBuffer = await ctx.stub.getState(drugCompositeKey).catch((err) => console.log(err));
              let jsonDrugDetail = JSON.parse(drugDataBuffer.toString());
              console.log("jsonDrugDetail=> " + jsonDrugDetail.owner);
              console.log("jsonDrugDetail=> " + jsonDrugDetail.manufacturer);
              jsonDrugDetail.owner = generateTransporterCompanyID;

              let drugJSONdate = Buffer.from(JSON.stringify(jsonDrugDetail));
              await ctx.stub.putState(drugCompositeKey, drugJSONdate);
            }
            return shipmentObject;
          }
        } else {
          console.log(
            "listOfAssetsLength is " +
              listOfAssetsLength +
              " and " +
              "parsedPurchaseOrder.quantity " +
              parsedPurchaseOrder.quantity +
              " length DOES NOT matches"
          );
          console.log("Sorry! Can'tProceed!");
        }
      }
    }
  }

  async updateShipment(ctx, buyerCRN, drugName, transporterCRN) {
    let transporterResultsIterator = await ctx.stub.getStateByPartialCompositeKey(
      "org.pharma-network.pharmanet.company",
      [transporterCRN]
    );

    let transporterResponseRange = await transporterResultsIterator.next();
    console.log("responseRange=> " + transporterResponseRange);
    if (!transporterResponseRange || !transporterResponseRange || !transporterResponseRange.value.key) {
      return "Invalid transporterCRN";
    }
    console.log("ResponseRange.value.key=>" + transporterResponseRange.value.key);

    let objectType;
    let attributes;
    ({ objectType, attributes } = await ctx.stub.splitCompositeKey(transporterResponseRange.value.key));

    let transportForUpdateShipmentName = attributes[1];
    let transportForUpdateShipmentCRN = attributes[0];

    var generateTransporterForShipmentUpdation = await ctx.stub.createCompositeKey(
      "org.pharma-network.pharmanet.company",
      [transportForUpdateShipmentCRN, transportForUpdateShipmentName]
    );

    console.log("this is the generated transporter composite key=>" + generateTransporterForShipmentUpdation);

    if (transportForUpdateShipmentCRN === transporterCRN) {
      console.log("Registered transporter");
      let generatedShipmentCompositeKey = await ctx.stub.createCompositeKey("org.pharma-network.pharmanet.shipment", [
        buyerCRN,
        drugName,
      ]);

      let shipmentDataBuffer = await ctx.stub.getState(generatedShipmentCompositeKey).catch((err) => console.log(err));
      console.log("This is the shipment details" + shipmentDataBuffer);
      let parsedShipmentData = JSON.parse(shipmentDataBuffer.toString());
      console.log("transporter composite key what sin shipment=> " + parsedShipmentData.transporter);
      console.log("generated transporter=>" + generateTransporterForShipmentUpdation);
      if (parsedShipmentData.transporter === generateTransporterForShipmentUpdation) {
        console.log("All good!transporter match");

        parsedShipmentData.status = "delivered";

        let statusChangeShipmentBuffer = Buffer.from(JSON.stringify(parsedShipmentData));
        await ctx.stub.putState(generatedShipmentCompositeKey, statusChangeShipmentBuffer);
        console.log("Shipment object's status has been changed");


        let buyerCRNResultsIteratorForOwner = await ctx.stub.getStateByPartialCompositeKey(
          "org.pharma-network.pharmanet.company",
          [buyerCRN]
        );

        var buyerCRNFoundForOwner = false;
        while (!buyerCRNFoundForOwner) {
          let buyerCRNFoundForOwnerResponseRange = await buyerCRNResultsIteratorForOwner.next();

          if (
            !buyerCRNFoundForOwnerResponseRange ||
            !buyerCRNFoundForOwnerResponseRange ||
            !buyerCRNFoundForOwnerResponseRange.value.key
          ) {
            return "Invalid transporterCRN";
          } else {
            buyerCRNFoundForOwner = true;
            let objectType;
            let attributes;
            ({ objectType, attributes } = await ctx.stub.splitCompositeKey(
              buyerCRNFoundForOwnerResponseRange.value.key
            ));

            let returnedBuyerCompanyNameForOwner = attributes[1];
            let returnedBuyerCompanyCRNForOwner = attributes[0];

            console.log("returnedBuyerCompanyNameForOwner=> " + returnedBuyerCompanyNameForOwner);
            console.log("returnedBuyerCompanyCRNForOwner=> " + returnedBuyerCompanyCRNForOwner);

            var generateBuyerCompanyIDForOwner = await ctx.stub.createCompositeKey(
              "org.pharma-network.pharmanet.company",
              [returnedBuyerCompanyCRNForOwner, returnedBuyerCompanyNameForOwner]
            );

            console.log("Transporter composite key created=> " + generateBuyerCompanyIDForOwner);
          }
        }
        let drugsInShipment = parsedShipmentData.assets;
        for (let i = 0; i <= drugsInShipment.length - 1; i++) {
          console.log(drugsInShipment[i]);
          let drugCompositeKeyID = drugsInShipment[i];
          console.log("drugCompositeKeyID is=> " + drugCompositeKeyID);
          let drugDataFromAddDrugBuffer = await ctx.stub.getState(drugCompositeKeyID).catch((err) => console.log(err));
          let JSONDrugDetailsForUpdation = JSON.parse(drugDataFromAddDrugBuffer.toString());

          console.log("JSONDrugDetailsForUpdation=>" + JSONDrugDetailsForUpdation);
          console.log("The shipment field for " + drugCompositeKeyID + " is " + JSONDrugDetailsForUpdation.shipment);
          console.log("The owner field for " + drugCompositeKeyID + " is " + JSONDrugDetailsForUpdation.owner);
          JSONDrugDetailsForUpdation.owner = generateBuyerCompanyIDForOwner;
          JSONDrugDetailsForUpdation.shipment = generatedShipmentCompositeKey;
          let modifiedDrugDetailsObject = Buffer.from(JSON.stringify(JSONDrugDetailsForUpdation));
          await ctx.stub.putState(drugCompositeKeyID, modifiedDrugDetailsObject);
          return modifiedDrugDetailsObject;
        }
      }
      return JSON.parse(shipmentDataBuffer.toString());
    } else {
      console.log("Transporter is not registered to the network");
    }
  }
  async retailDrug(ctx, drugName, serialNo, retailerCRN, customerAadhar) {
    const drugCompositeKeyForSearch = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.drug", [
      drugName,
      serialNo,
    ]);
    let drugCompositeKeyForSearchBuffer = await ctx.stub
      .getState(drugCompositeKeyForSearch)
      .catch((err) => console.log(err));
    let JSONDrugCompositeKeyForSearch = JSON.parse(drugCompositeKeyForSearchBuffer.toString());
    console.log("JSONDrugCompositeKeyForSearch.owner=> " + JSONDrugCompositeKeyForSearch.owner);
    console.log("retailerCRN=> " + retailerCRN);
    let retailerCRNResultsIteratorForComparision = await ctx.stub.getStateByPartialCompositeKey(
      "org.pharma-network.pharmanet.company",
      [retailerCRN]
    );

    var retailerCRNFoundForComparision = false;
    while (!retailerCRNFoundForComparision) {
      let retailerCRNResultsIteratorForComparisionResponseRange = await retailerCRNResultsIteratorForComparision.next();

      if (
        !retailerCRNResultsIteratorForComparisionResponseRange ||
        !retailerCRNResultsIteratorForComparisionResponseRange ||
        !retailerCRNResultsIteratorForComparisionResponseRange.value.key
      ) {
        return "Invalid transporterCRN";
      } else {
        retailerCRNFoundForComparision = true;
        let objectType;
        let attributes;
        ({ objectType, attributes } = await ctx.stub.splitCompositeKey(
          retailerCRNResultsIteratorForComparisionResponseRange.value.key
        ));

        let returnedRetailerCompanyNameForComparision = attributes[1];
        let returnedRetailerCompanyCRNForComparision = attributes[0];

        console.log("returnedBuyerCompanyNameForOwner=> " + returnedRetailerCompanyNameForComparision);
        console.log("returnedRetailerCompanyCRNForComparision=> " + returnedRetailerCompanyCRNForComparision);

        var generateRetailerCompanyIDForOwner = await ctx.stub.createCompositeKey(
          "org.pharma-network.pharmanet.company",
          [returnedRetailerCompanyCRNForComparision, returnedRetailerCompanyNameForComparision]
        );

        console.log("A=> " + generateRetailerCompanyIDForOwner);
        console.log("B=> " + JSONDrugCompositeKeyForSearch.owner);
      }
    }

    if (JSONDrugCompositeKeyForSearch.owner === generateRetailerCompanyIDForOwner) {
      console.log("Yes he is the owner of the drug");
      JSONDrugCompositeKeyForSearch.owner = customerAadhar;

      let modifiedDrugDetailsObjectForCustomer = Buffer.from(JSON.stringify(JSONDrugCompositeKeyForSearch));
      await ctx.stub.putState(drugCompositeKeyForSearch, modifiedDrugDetailsObjectForCustomer);
      console.log("Hello" + JSONDrugCompositeKeyForSearch);
      return JSONDrugCompositeKeyForSearch;
    } else {
      console.log("Sorry you are not the owner of this drug");
    }
  }
/*
  Used to view the current state of the drug asset.
  @params drugName - Name of the drug
          serialNo - Serial number of the drug
  @returns drugJSON - current state of the drug
  */
 async viewDrugCurrentState(ctx, drugName, serialNo) {
    const productID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.drug", [drugName, serialNo]);
    let drugDataBuffer = await ctx.stub.getState(productID).catch((err) => console.log(err));
    return JSON.parse(drugDataBuffer.toString());
  }
/*
  Used to view the lifecycle of the product by fetching trasactions from blockchain
  @params drugName - name of the drug
          serialNo - serial number of the drug
  @returns result - Transaction history of the drug
  */
 async viewHistory(ctx, drugName, serialNo) {
    const productID = ctx.stub.createCompositeKey("org.pharma-network.pharmanet.drug", [drugName, serialNo]);

    let iterator = await ctx.stub.getHistoryForKey(productID);
    let result = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value) {
        const obj = JSON.parse(res.value.value.toString("utf8"));
        result.push(obj);
      }
      res = await iterator.next();
    }
    await iterator.close();
    return result;
  }
}

module.exports = PharmanetContract;
