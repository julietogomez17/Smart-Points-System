
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageOps
from torchvision.models import resnet18, ResNet18_Weights


DEVICE = torch.device("cpu")

WEIGHTS = ResNet18_Weights.IMAGENET1K_V1
TRANSFORM = WEIGHTS.transforms()

# Load the pretrained ResNet-18.
model = resnet18(weights=WEIGHTS)

# Replace the final classification layer.
# Output becomes a vector of 512 visual features.
model.fc = torch.nn.Identity()

model = model.to(DEVICE)
model.eval()


def extract_features(photo_path):
    photo_path = Path(photo_path)

    with Image.open(photo_path) as image:
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")

        image_tensor = TRANSFORM(image)
        image_tensor = image_tensor.unsqueeze(0)

    image_tensor = image_tensor.to(DEVICE)

    with torch.inference_mode():
        features = model(image_tensor)

    return (
        features.cpu()
        .numpy()
        .flatten()
        .astype(np.float32)
    )
