document.addEventListener("adobe_dc_view_sdk.ready", function()
    {   let serverURL = "https://guarded-garden-69104.herokuapp.com";
        let embedClientId = "0380af08d146472fad73e31a5c5453f1";

        let viewDiv = document.getElementById("pdfviewercontainer");
        let contractName = viewDiv.getAttribute("contract");
        let candidateName = viewDiv.getAttribute("candidate");
        console.log(contractName, candidateName);
        const viewerConfig = {
            defaultViewMode: "FIT_PAGE",  //default mode is set to fit_page
            embedMode: "FULL_WINDOW",     //display mode is set to inline
            showPageControls : true,  //display controls
            dockPageControls:true, //user can dock/undock
            showAnnotationTools: true, //display annotation tools
            showDownloadPDF : true,  //display download option
            showPrintPDF:true,  //display print option
            showLeftHandPanel: false,
              /* Enable commenting APIs */
            enableAnnotationAPIs: true /* Default value is false */,
            /* Include existing PDF annotations and save new annotations to PDF buffer */
            includePDFAnnotations: true /* Default value is false */,   
        };
        // custom flags for UI configurations
        const customFlags = {
            downloadWithAnnotations: true /* Default value is false */,
            printWithAnnotations: true /* Default value is false */,
        };
        // eslint-disable-next-line
        var adobeDCView = new AdobeDC.View({clientId: embedClientId, divId: "adobe-dc-view"});
        
        var previewFilePromise = adobeDCView.previewFile(
        {
            content:   {location : {url: `${serverURL}/${contractName}_${candidateName}`}},
            metaData: {fileName : `${contractName}_${candidateName}.pdf`, id:`${contractName}_${candidateName}`}
        }, viewerConfig);

        //user profile name UI config
        let profile = {
          userProfile: {
            name: localStorage.getItem('candidate')==="false"? "(CREATOR) "+localStorage.getItem("user") : localStorage.getItem('user'),
          },
        };

        adobeDCView.registerCallback(
        // eslint-disable-next-line
        AdobeDC.View.Enum.CallbackType.GET_USER_PROFILE_API,
        function () {
          return new Promise((resolve, reject) => {
            resolve({ 
              // eslint-disable-next-line
              code: AdobeDC.View.Enum.ApiResponseCode.SUCCESS,
              //set user name instead of guest
              data: profile,
            });
          });
        }
      );
          //annotations apis manager
    previewFilePromise.then(function (adobeViewer) {
      adobeViewer.getAnnotationManager().then(function (annotationManager) {
        //set UI configurations
        annotationManager
          .setConfig(customFlags)
          .then(function () {})
          .catch(function (error) {});

        //array to store annotations
        var oldAnnos = [];
        //updating annotations automatically
        setInterval(async () => {
          await fetch(`${serverURL}/copycontract/annotations/find`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ fileId: `${contractName}_${candidateName}` }),
          })
            .then((response) => {
              return response.json();
            })
            .then((res) => {
              let updatedAnnos = [];
              res.forEach((r) => {
                updatedAnnos.push(r.data);
              });
              //updated annos contains the updated version of annotations
              //if the present annos are different than updated ones, then updates it otherwise not
              if (JSON.stringify(updatedAnnos) !== JSON.stringify(oldAnnos)) {
                let result = updatedAnnos.filter((ol) => {
                  return !oldAnnos.some((o2) => {
                    return ol.id === o2.id;
                  });
                });
                //add annotations through annotationManager API
                annotationManager
                  .addAnnotations(result)
                  .then(function () {})
                  .catch(function (error) {});
                //updates the present annos
                oldAnnos = oldAnnos.concat(result);
              }
            });
        }, 2000);

        /* API to register events listener */
        annotationManager.registerEventListener(
          function (event) {
            switch (event.type) {
              // if annotations are added
              case "ANNOTATION_ADDED":
                if (event.data.bodyValue !== "") {
                  try {
                    if (
                      //if the user doesn't give any position to annotation, it will default go to this boundingBox location
                      //therefore checking if the two obejcts are same and then updating the position to right,lower position of the PDF page.
                      JSON.stringify(event.data.target.selector.boundingBox) ===
                      JSON.stringify([
                        594.4658823529412,
                        774.1270588235294,
                        611.2376470588235,
                        792.7623529411765,
                      ])
                    ) {
                      event.data.target.selector.boundingBox = [0, 0, 0, 0];
                    }
                  } catch (error) {}
                  //update added annotation to database storage by sending event data with POST request
                  (async () => {
                    await fetch(`${serverURL}/copycontract/annotations/add`, {
                      method: "POST",
                      headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        data: event.data,
                        fileId: `${contractName}_${candidateName}`,
                      }),
                    });
                  })();
                }
                break;
              case "ANNOTATION_UPDATED":
                //update updated annotation to database storage by sending event data with POST request
                (async () => {
                  await fetch(`${serverURL}/copycontract/annotations/update`, {
                    method: "POST",
                    headers: {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ data: event.data, fileId: `${contractName}_${candidateName}` }),
                  });
                })();
                break;
              //delete annotation from the database storage by sending event data with POST request
              case "ANNOTATION_DELETED":
                (async () => {
                  await fetch(`${serverURL}/copycontract/annotations/delete`, {
                    method: "POST",
                    headers: {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ data: event.data, fileId: `${contractName}_${candidateName}` }),
                  });
                })();
                break;
                default:;
            }
          },
          {
            /* Pass the list of events in listenOn. */
            /* If no event is passed in listenOn, then all the annotation events will be received. */
            listenOn: [],
          }
        );

      });
    });      
})
