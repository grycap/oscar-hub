#!/usr/bin/env python3

"""
Author: Enoc Martínez (modified version)
Institution: Universitat Politècnica de Catalunya (UPC)
Email: enoc.martinez@upc.edu
License: MIT
Created: 07/05/2024
"""

from argparse import ArgumentParser
import os
from datetime import datetime, timezone
from PIL import Image
import logging
from logging.handlers import TimedRotatingFileHandler
import time
import json
from ultralytics import YOLO

def get_pic_size(pic: str) -> int:
    """
    Returns the maximum dimension (width or height) of an image.
    """
    im = Image.open(pic)
    width, height = im.size
    im.close()
    return max(width, height)

def setup_log(name, path="log"):
    """
    Sets up the logging module with a rotating file handler and a console handler.
    """
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    if not os.path.exists(path):
        os.makedirs(path)

    filename = os.path.join(path, name)
    if not filename.endswith(".log"):
        filename += ".log"

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    log_formatter = logging.Formatter('%(asctime)s.%(msecs)03d %(levelname)-7s: %(message)s',
                                      datefmt='%Y/%m/%d %H:%M:%S')
    handler = TimedRotatingFileHandler(filename, when="midnight", backupCount=7)
    handler.setFormatter(log_formatter)
    logger.addHandler(handler)

    consoleHandler = logging.StreamHandler()
    consoleHandler.setFormatter(log_formatter)
    logger.addHandler(consoleHandler)

    logger.info("")
    logger.info(f"===== {name} =====")

    return logger

def yolov8_result_to_list(results, save_image=""):
    """
    Converts YOLOv8 results into a list of detections and optionally saves
    the image with bounding boxes.
    """
    for result in results:
        boxes = result.boxes
        if save_image:
            im_array = result.plot(line_width=1)
            im = Image.fromarray(im_array[..., ::-1])
            im.save(save_image)
        detections = []
        for box in boxes:
            cls = int(box.cls)
            taxa = result.names[cls]
            confidence = round(float(box.conf), 3)
            bb = [round(float(x), 3) for x in box.xyxyn[0]]
            detections.append({
                "taxa": taxa,
                "confidence": confidence,
                "bounding_box_xyxy": bb
            })
    return detections

if __name__ == "__main__":
    argparser = ArgumentParser()
    argparser.add_argument("-i", "--input", type=str, required=True, help="Path to the input image")
    argparser.add_argument("-o", "--output", type=str, default="output", help="Output directory")
    argparser.add_argument("--model", type=str, default="yolov8x_obsea_19sp_2538img.pt", help="YOLOv8 model path or name")
    args = argparser.parse_args()

    log = setup_log("YOLO")
    log.info("Loading model...")
    t = time.time()
    model = YOLO(args.model)
    log.info(f"Model loaded in {time.time() - t:.03f} s")

    os.makedirs(args.output, exist_ok=True)
    input_image = args.input
    if not os.path.isfile(input_image):
        log.error(f"Image not found: {input_image}")
        exit(1)

    imgsize = get_pic_size(input_image)
    basename = os.path.basename(input_image)
    output_picture = os.path.join(args.output, basename)
    output_json = os.path.join(args.output, os.path.splitext(basename)[0] + ".json")

    t = time.time()
    log.info(f"Running inference on image: {input_image}")
    results = model.predict([input_image], imgsz=imgsize, iou=0.5, conf=0.5, stream=True)
    detections = yolov8_result_to_list(results, save_image=output_picture)
    log.info(f"Inference took {time.time() - t:.03f} s")

    with open(output_json, "w") as f:
        f.write(json.dumps(detections, indent=2))

    log.info("Task completed successfully!")
