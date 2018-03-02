var labelTool = {
    dataTypes: [],
    workBlob: '',         // Base url of blob
    curFile: 0,           // Base name of current file
    fileNames: [],         // List of basenames of the files
    labelId: -1,          // Initialize with 'setParameters'
    hasImage: false,      // Initialize with 'setParameters'
    hasPCD: false,        // Initialize with 'setParameters'
    hasLoadedImage: false,
    hasLoadedPCD: false,
    originalSize: [0, 0], // Original size of jpeg image
    originalBboxes: [],   // For checking modified or not
    hold_flag: false,     // Hold bbox flag
    loadCount: 0,         // To prevent sending annotations before loading them
    selectedDataType: "",
    skipFrameCount: 1,
    targetClass: "Car",
    pageBox: document.getElementById('page_num'),

    /********** Externally defined functions **********
     * Define these functions in the labeling tools.
     **************************************************/
    
    onLoadData: function(dataType, f) {
	this.localOnLoadData[dataType] = f;
    },

    onInitialize: function(dataType, f) {
	this.localOnInitialize[dataType] = f;
    },
    
    /****************** Private functions **************/

    localOnLoadData: {
	"Image": function() {},
	"PCD": function() {}
    },

    localOnLoadAnnotation: {
	"Image": function(index, annotation) {},
	"PCD": function(index, annotation) {}
    },

    localOnSelectBBox: {
	"Image": function(newIndex, oldIndex) {},
	"PCD": function(newIndex, oldIndex) {}
    },
    
    localOnInitialize: {
	"Image": function() {},
	"PCD": function() {}
    },
    
    // Visualize 2d and 3d data
    showData: function() {
	if (this.selectedDataType == "Image" && !this.hasLoadedImage) {
	    this.localOnLoadData["Image"]();
	    this.hasLoadedImage = true;
	}
	if (this.selectedDataType == "PCD" && !this.hasLoadedPCD) {
	    this.localOnLoadData["PCD"]();
	    this.hasLoadedPCD = true;
	}
    },
        
    // Set values to this.bboxes from annotations
    loadAnnotations: function(annotations) {
	// Remove old bounding boxes.
	bboxes.clear();
	// Add new bounding boxes.
	var index = 0;
	console.log("LOOPs: " + annotations.length - 1);
	for (var i in annotations) {
	    console.log("LOOP" + i);
	    console.log(bboxes.contents);
	    var label = annotations[i].label;
	    switch (label) {
		case "car":         label = "Car";        break;
		case "pedestrian":  label = "Pedestrian"; break;
		case "motorbike":   label = "Motorbike";  break;
		case "bus":         label = "Bus";        break;
		case "truck":       label = "Truck";      break;
		case "cyclist":     label = "Cyclist";    break;
		case "train":       label = "Train";      break;
		case "obstacle":    label = "Obstacle";   break;
		case "stop_signal": label = "StopSignal"; break;
		case "wait_signal": label = "WaitSignal"; break;
		case "go_signal":   label = "GoSignal";   break;
	    }
	    annotations[i].label = label;
	    var hasLabel = {"Image": false,
			    "PCD": false};
	    var annotation = annotations[i];
	    bboxes.selectEmpty();
	    if (!(annotation.left == 0 && annotation.top == 0 &&
		  annotation.right == 0 && annotation.bottom == 0)) {
		var minPos = convertPositionToCanvas(annotation.left, annotation.top);
		var maxPos = convertPositionToCanvas(annotation.right, annotation.bottom);
		var params = {x: minPos[0],
			      y: minPos[1],
			      width: maxPos[0] - minPos[0],
			      height: maxPos[1] - minPos[1]
		};
		bboxes.setTarget("Image", params, label);
		hasLabel["Image"] = true;
	    }
	    var readMat = MaxProd(CameraExMat,[parseFloat(annotation.x),
					       parseFloat(annotation.y),
					       parseFloat(annotation.z),
					       1]);
	    var tmpWidth = parseFloat(annotation.width);
	    var tmpHeight = parseFloat(annotation.height);
	    var tmpDepth = parseFloat(annotation.length);
	    if (!(tmpWidth == 0.0 && tmpHeight == 0.0 && tmpDepth == 0.0)) {
		hasPCDLabel = true;
		tmpWidth = Math.max(tmpWidth, 0.0001);
		tmpHeight = Math.max(tmpHeight, 0.0001);
		tmpDepth = Math.max(tmpDepth, 0.0001);
		var readfile_parameters = {
		    x: readMat[0],
		    y: -readMat[1],
		    z: readMat[2],
		    delta_x: 0,
		    delta_y: 0,
		    delta_z: 0,
		    width: tmpWidth,
		    height: tmpHeight,
		    depth: tmpDepth,
		    yaw: parseFloat(annotation.rotation_y),
		    numbertag: parameters.i + 1,
		    label: annotation.label
		};
		var params = {
		    // TODO!!!!!!!!!!!!
		};
		addbbox(readfile_parameters, index); // TODO? -> bboxes.onAdd
		bboxes.setTarget("PCD", params, label);
		hasLabel["PCD"] = true;
	    }
	    if (!hasLabel["Image"] && !hasLabel["PCD"]) {
		bboxes.pop();
	    }
	}
	// Backup initial positions.
	/* this.originalBboxes = this.bboxes.concat();*/
    },

    // Create annotations from this.bboxes
    createAnnotations: function() {
	var annotations = [];
	for (var i = 0; i < bboxes.length(); ++i) {
	    var annotation = {label: bboxes.get(i, "class"),
			      truncated: 0,
			      occluded: 3,
			      alpha: 0, // Calculated by Python script
			      left: 0,
			      top: 0,
			      right: 0,
			      bottom: 0,
			      height: 0,
			      width: 0,
			      length: 0, // -->>>>> DEPTH!!!!!!!!!!!!!!!
			      x: 0,
			      y: 0,
			      z: 0,
			      rotation_y: 0};
	    if (!bboxes.exists(i, "Image") && !bboxes.exists(i, "PCD")) {
		continue;
	    }
	    if (bboxes.exists(i, "Image")) {
		var rect = bboxes.get(i, "Image")["rect"];
		var minPos = convertPositionToFile(rect.attr("x"), rect.attr("y"));
		var maxPos = convertPositionToFile(rect.attr("x") + rect.attr("width"),
						   rect.attr("y") + rect.attr("height"));
		annotation["left"] = minPos[0];
		annotation["top"] = minPos[1];
		annotation["right"] = maxPos[0];
		annotation["bottom"] = maxPos[1];
	    }
	    if (bboxes.exists(i, "PCD")) {
		var cubeMat = [cube_array[i].position.x,
			       cube_array[i].position.y,
			       cube_array[i].position.z,
			       1];
		var resultMat = MaxProd(invMax(CameraExMat), cubeMat);
		annotation["height"] = cube_array[i].scale.y;
		annotation["width"] = cube_array[i].scale.x;
		annotation["length"] = cube_array[i].scale.z;
		annotation["x"] = resultMat[0];
		annotation["y"] = resultMat[1];
		annotation["z"] = resultMat[2];
		annotation["rotation_y"] = cube_array[i].rotation.z;
	    }
	    annotations.push(annotation);
	}
	return annotations;
    },

    /* addImageBBoxToTable: function(index) {
       $("#bbox-image-" + index).css("color", classes[this.bboxes[index]["label"]].color);
     * },
     * 
     * addPCDBBoxToTable: function(index) {
       var color = classes.selected().color;
       if (this.bboxes[index] != undefined) {
       color = classes[this.bboxes[index]["label"]].color;
       }
       $("#bbox-pcd-" + index).css("color", color);
     * },
     * 
     * removeImageBBoxFromTable: function(index) {
       $("#bbox-image-" + index).css("color", "#888");
     * },
     * 
     * removePCDBBoxFromTable: function(index) {
       $("#bbox-pcd-" + index).css("color", "#888");
     * },

     * clearBBoxTable: function() {
       $("#bbox-table").empty();
     * },
     */
    /* 
     * addBBoxToTable: function(index, hasImageLabel, hasPCDLabel) {
       if (!$("#bbox-number-" + index)[0]) {
       var $li = $('<li class="jpeg-label-sidebar-item" onClick="labelTool.selectBBox(' + index + ')">'
       + '<div class="label-tool-sidebar-number-box">'
       + '<p class="label-tool-sidebar-text number" id="bbox-number-' + index + '">' + index + '.</p>'
       + '</div>'
       + '</li>'
       );
       $li.append($('<p class="label-tool-sidebar-text bbox" id="bbox-image-' + index + '">Image</p>'));
       $li.append($('<p class="label-tool-sidebar-text bbox" id="bbox-pcd-' + index + '">PCD</p>'));
       $("#bbox-table").append($li);
       }
       if (hasImageLabel) {
       this.addImageBBoxToTable(index);
       }
       if (hasPCDLabel) {
       this.addPCDBBoxToTable(index);
       }
     * },*/
    
    initialize: function() {
	this.pageBox.placeholder = (this.curFile + 1) + "/" + this.fileNames.length;
	bboxes.selectEmpty();
	this.dataTypes.forEach(function(dataType) {
	    this.localOnInitialize[dataType]();
	}.bind(this));
    },

    getAnnotations() {
	this.loadCount++;
	var fileName = this.fileNames[this.curFile] + ".txt";
	var targetFile = this.curFile;
	request({
	    url: '/label/annotations/',
	    type: 'GET',
	    dataType: 'json',
	    data: {file_name: fileName, label_id: this.labelId},
	    success: function(res) {
		if (targetFile == this.curFile) {
		    this.loadAnnotations(res);
		}
		this.loadCount--;
	    }.bind(this)
	})
    },

    setAnnotations() {
	if (this.loadCount != 0) {
	    return;
	}
	this.pending = true;
	var annotations = this.createAnnotations();
	var fileName = this.fileNames[this.curFile];
	var fileNumber = this.curFile;
	request({
	    url: '/label/annotations/',
	    type: 'POST',
	    dataType: 'html',
	    data: {file_name: fileName + ".txt",
		   annotations: JSON.stringify(annotations),
		   label_id: this.labelId},
	    success: function(res) {
		this.pending = false;
	    }.bind(this),
	    error: function(res) {
		this.pending = false;
	    }.bind(this)
	})
    },

    getInformations() {
	request({
	    url: "/labels/",
	    type: "GET",
	    dataType: "json",
	    data: {label_id: this.labelId},
	    complete: function(res) {
		var dict = JSON.parse(res.responseText)[0];
		this.workBlob = dict.blob;
		this.curFile = dict.progress - 101;
		this.getImageSize();
	    }.bind(this)
	    /* ,fail: function(res) {
	       if (this.dataType == "JPEG") {
	       textBox.value = "Failed....";//TODO
	       }
	       }.bind(this)*/
	})
    },

    getImageSize() {
	request({
	    url: "/label/image_size/",
	    type: "GET",
	    dataType: "json",
	    data: {label_id: this.labelId},
	    complete: function(res) {
		var dict = JSON.parse(res.responseText);
		this.originalSize[0] = dict.width;
		this.originalSize[1] = dict.height;
		this.getFileNames();
	    }.bind(this)
	    /* ,fail: function(res) {
	       if (this.dataType == "JPEG") {
	       textBox.value = "Failed....";//TODO
	       }
	       }.bind(this)*/
	})
    },
    
    getFileNames() {
	request({
	    url: "/label/file_names/",
	    type: "GET",
	    dataType: "json",
	    data: {label_id: this.labelId},
	    complete: function(res) {
		var dict = JSON.parse(res.responseText);
		this.fileNames = dict["file_names"];
		this.initialize();
		this.showData();
		this.getAnnotations();
	    }.bind(this)
	});
    },

    setParameters: function(labelId, dataTypeString) {
	["Image", "PCD"].forEach(function(dataType) {
	    if (dataTypeString.indexOf(dataType) != -1) {
		this.dataTypes.push(dataType);
	    }
	}.bind(this));
	this.labelId = labelId;
	this.selectedDataType = this.dataTypes[0];
	dat.GUI.toggleHide();
	if (!(this.dataTypes.indexOf("Image") >= 0)) {
	    this.toggleDataType();
	}
    },
    
    /****************** Public functions **************/

    isModified: function() {
	return this.bboxes.toString() != this.originalBboxes.toString();
    },

    getFileName: function(index) {
	return this.fileNames[index];
    },

    getTargetFileName: function() {
	return this.fileNames[this.curFile];
    },
    /* 
     *     getImageBBox: function(index) {
     * 	if (this.bboxes[index] == undefined) {
     * 	    return undefined;
     * 	}
     * 	return this.bboxes[index]["Image"];
     *     },
     * 
     *     getPCDBBox: function(index) {
     * 	if (this.bboxes[index] == undefined) {
     * 	    return undefined;
     * 	}
     * 	return this.bboxes[index]["PCD"];
     *     },
     * 
     *     getSelectedImageBBox: function() {
     * 	if (this.bboxes[this.targetBBox] == undefined) {
     * 	    return undefined;
     * 	}
     * 	return this.bboxes[this.targetBBox]["Image"];
     *     },
     * 
     *     getSelectedPCDBBox: function() {
     * 	if (this.bboxes[this.targetBBox] == undefined) {
     * 	    return undefined;
     * 	}
     * 	return this.bboxes[this.targetBBox]["PCD"];
     *     },
     *     
     *     setImageBBox: function(index, bbox) {
     * 	if (this.bboxes[index] == undefined) {
     * 	    this.bboxes[index] = {
     * 		"label": this.targetClass,
     * 		"Image": bbox
     * 	    };
     * 	} else {
     * 	    this.bboxes[index]["Image"] = bbox;
     * 	}
     *     },
     * 
     *     setPCDBBox: function(index, bbox) {
     * 	if (this.bboxes[index] == undefined) {
     * 	    this.bboxes[index] = {
     * 		"label": this.targetClass,
     * 		"PCD": bbox
     * 	    };
     * 	} else {
     * 	    this.bboxes[index]["PCD"] = bbox;
     * 	}
     *     },*/
    /* 
     *     setSelectedImageBBox: function(bbox) {
     * 	if (this.targetBBox == -1) {
     * 	    console.error("No bboxes selected.");
     * 	}
     * 	if (this.bboxes[this.targetBBox] == undefined) {
     * 	    this.bboxes[this.targetBBox] = {
     * 		"label": this.targetClass,
     * 		"Image": bbox
     * 	    };
     * 	} else {
     * 	    this.bboxes[this.targetBBox]["Image"] = bbox;
     * 	}
     *     },*/

    hasData: function(dataType) {
	return dataType in this.dataTypes;
    },
    
    previousFrame: function() {
	if (this.curFile >= 0 + this.skipFrameCount) {
	    this.changeFrame(this.curFile - this.skipFrameCount);
	} else if (this.curFile != 0) {
	    this.changeFrame(0);
	}
    },

    nextFrame: function() {
	if (this.curFile < (this.fileNames.length - 1 - this.skipFrameCount)) {
	    this.changeFrame(this.curFile + this.skipFrameCount);
	} else if (this.curFile != this.fileNames.length - 1) {
	    this.changeFrame(this.fileNames.length - 1);
	}
    },

    jumpFrame: function() {
	if (0 <= Number(this.pageBox.value) - 1 && Number(this.pageBox.value) - 1 < this.fileNames.length) {
	    this.changeFrame(Number(this.pageBox.value) - 1);
	}
    },

    changeFrame: function(fileNumber) {
	/* if (this.isModified() || this.hasPCD) {*/ //TODO: Track whether bbox is modified or not
	this.setAnnotations();
	/* }*/
	this.curFile = fileNumber;
	this.pageBox.placeholder = (this.curFile + 1) + "/" + this.fileNames.length;
	this.pageBox.value = "";
	if (this.hasPCD && this.hasLoadedPCD) {
	    ground_mesh.visible = false;
	    image_array[0].visible = false;
	}
	this.hasLoadedImage = false;
	this.hasLoadedPCD = false;
	this.showData();
	if (!this.hold_flag) {
	    this.getAnnotations();
	}
    },

    addResizeEventForImage: function() {
	$(window).unbind("resize");
	$(window).resize(function() {
	    keepAspectRatio();
	});
    },
    
    addResizeEventForPCD: function() {
	$(window).unbind("resize");
	$(window).resize(function() {
	    $(function() {
		if ($("#jpeg-label-canvas").css("display") == "block") {
		    var windowWidth = $('#label-tool-wrapper').width();
		    var width = windowWidth / 4 > 100 ? windowWidth / 4 : 100;
		    var height = width * 5 / 8;
		    changeCanvasSize(width, height);
		}
	    });
	});
    },
    
    toggleDataType: function() {
	if (this.selectedDataType == "Image") {
	    if (this.dataTypes.indexOf("PCD") >= 0) {
		console.log("HOGE");
		dat.GUI.toggleHide();
		this.selectedDataType = "PCD";
		$('#canvas3d').show();
		if (!bird_view_flag) {
		    $('#jpeg-label-canvas').hide();
		} else {
		    changeCanvasSize($("#canvas3d").width() / 4, $("#canvas3d").width() * 5 / 32);
		}
		document.getElementById("label-toggle-button").innerText = "PCD";
		this.addResizeEventForPCD();
		this.showData();
	    }
	} else {
	    if (this.dataTypes.indexOf("Image") >= 0) {
		dat.GUI.toggleHide();
		this.selectedDataType = "Image";
		$('#canvas3d').hide();
		$('#jpeg-label-canvas').show();
		document.getElementById("label-toggle-button").innerText = "Image";
		this.addResizeEventForImage();
		keepAspectRatio();
		this.showData();
	    }
	}
    },

    toggleHold: function() {
	if (this.hold_flag) {
	    $("#hold-toggle-button").css("color", "#ddd");
	} else {
	    $("#hold-toggle-button").css("color", "#4894f4");
	}
	this.hold_flag = !this.hold_flag;
    },

    resetBBoxes: function() {
	this.getAnnotations();
    },
    
    /* selectYes() {
       $(function() {
       $("#label-tool-dialogue-overlay").remove();
       });
       if (updateFlag)
       return;
       updateFlag = true;
       document.getElementById("overlay-text").innerHTML="Updating Database...";
       $(function() {
       $("#label-tool-status-overlay").fadeIn();
       });
       this.setAnnotations();
       $.ajax({
       url: '/labeling_tool/update_database/',
       type: 'POST',
       dataType: 'json',
       data: {images: this.fileNames.length,
       label_id: this.labelId},
       complete: function(res) {
       location.href = "label_select";
       }.bind(this)
       })
     * }
     */
    /*     selectNo() {
     * 	$(function() {
     * 	    $("#label-tool-dialogue-overlay").fadeOut();
     * 	});
     *     }
     * */

    handlePressKey: function(code, value) {
	if(code === 13) {
	    this.jumpFrame();
	}
    }
}

$("#previous-frame-button").keyup(function(e) {
    if (e.which === 32) {
        return false;
    }
});

$("#next-frame-button").keyup(function(e) {
    if (e.which === 32) {
	return false;
    }
});    

$("#frame-skip").change(function() {
    var value = $(this).val();
    if (value == "") {
	value = 1;
    } else {
	value = parseInt(value);
    }
    labelTool.skipFrameCount = value;
});