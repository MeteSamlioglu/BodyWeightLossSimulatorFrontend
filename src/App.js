import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs-backend-webgl';
import './App.css'; // Import the CSS file

function App() {
  const imageRef = useRef(null);
  const [imageURL, setImageURL] = useState(null);
  const [returnedImages, setReturnedImages] = useState([]);
  const [activeButton, setActiveButton] = useState(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [desiredBmi, setDesiredBmi] = useState(22.5); // New state for desired BMI
  const [bmi, setBmi] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [weightLossData, setWeightLossData] = useState([]);
  const [bodyPartsData, setBodyPartsData] = useState(null);
  const [advancedInputs, setAdvancedInputs] = useState({
    face: 0.01,
    torso: 0.02,
    upperLegs: 0.01,
    hips: 0.02,
    arms: 0.005,
    lowerLeg: 0.01,
  });

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      setImageURL(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const detect = async (net) => {
    const image = imageRef.current;

    const imageWidth = image.clientWidth;
    const imageHeight = image.clientHeight;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);

    tempCanvas.toBlob(async (blob) => {
      const person = await net.segmentPersonParts(tempCanvas);
      console.log(person);

      const bodyPartsData = {
        score: person.allPoses[0].score,
        keypoints: person.allPoses[0].keypoints.reduce((acc, keypoint) => {
          acc[keypoint.part] = {
            position: keypoint.position,
            score: keypoint.score
          };
          return acc;
        }, {})
      };

      setBodyPartsData(bodyPartsData);
      postBodyPartsData(bodyPartsData, blob);
    }, 'image/png');
  };

  const runBodysegment = useCallback(async () => {
    if (imageRef.current) {
      const net = await bodyPix.load();
      console.log("BodyPix model loaded.");
      detect(net);
    }
  }, []);

  const postBodyPartsData = async (bodyPartsData, imageBlob) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(bodyPartsData));
    formData.append('image', imageBlob, 'resized_image.png');

    try {
      const response = await fetch("http://localhost:5000/BodyWeightLoss", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setReturnedImages([url]);
      console.log("Data successfully sent and received:", url);
    } catch (error) {
      console.error("Error sending data:", error);
    }
  };

  const handleButtonClick = (button) => {
    setActiveButton((prevActiveButton) => (prevActiveButton === button ? null : button));
    if (button !== 'button1') {
      setHeight('');
      setWeight('');
      setBmi(null);
      setShowTable(false);
      setWeightLossData([]);
    }
  };

  const handleHeightChange = (event) => {
    setHeight(event.target.value);
  };

  const handleWeightChange = (event) => {
    setWeight(event.target.value);
  };

  const handleDesiredBmiChange = (event) => {
    setDesiredBmi(event.target.value);
  };

  const calculateBmi = (weight) => {
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(2);
  };

  const generateWeightLossData = () => {
    const data = [];
    let currentWeight = parseFloat(weight);
  
    const decreasePercentages = {
      torso: 0.04,
      hipAndThigh: 0.02,
      legs: 0.02,
      faceAndNeck: 0.01,
      arms: 0.005
    };
  
    const months = [1, 3, 6, 12, 15, 18, 24];
  
    // Initialize cumulative losses
    let cumulativeLosses = {
      torso: 0,
      hipAndThigh: 0,
      legs: 0,
      faceAndNeck: 0,
      arms: 0
    };
  
    for (const month of months) {
      if (calculateBmi(currentWeight) <= desiredBmi) break;
  
      // Add the initial percentages to the cumulative losses
      cumulativeLosses.torso += decreasePercentages.torso;
      cumulativeLosses.hipAndThigh += decreasePercentages.hipAndThigh;
      cumulativeLosses.legs += decreasePercentages.legs;
      cumulativeLosses.faceAndNeck += decreasePercentages.faceAndNeck;
      cumulativeLosses.arms += decreasePercentages.arms;
  
      data.push({
        month: `${month}th`,
        torso: cumulativeLosses.torso.toFixed(2),
        hipAndThigh: cumulativeLosses.hipAndThigh.toFixed(2),
        legs: cumulativeLosses.legs.toFixed(2),
        faceAndNeck: cumulativeLosses.faceAndNeck.toFixed(2),
        arms: cumulativeLosses.arms.toFixed(2),
        totalWeight: currentWeight.toFixed(2),
        bmi: calculateBmi(currentWeight),
      });
      currentWeight *= 0.9;
    }
  
    setWeightLossData(data);
    setShowTable(true);
  };
  

  const handleCalculateBmi = () => {
    const bmiValue = calculateBmi(parseFloat(weight));
    setBmi(bmiValue);
    generateWeightLossData();
  };

  const handleShowClick = async (month) => {
    console.log(month);
    if (imageURL && bodyPartsData) {
      try {
        const response = await fetch(imageURL);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('month', month);
        formData.append('image', blob, 'uploaded_image.png');
        formData.append('data', JSON.stringify(bodyPartsData));

        const uploadResponse = await fetch("http://localhost:5000/UploadImage", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Network response was not ok");
        }

        const blobResponse = await uploadResponse.blob();
        const url = URL.createObjectURL(blobResponse);
        setReturnedImages((prev) => [...prev, url]);
        console.log("Image, month, and body parts data successfully sent:", url);
      } catch (error) {
        console.error("Error sending image, month, and body parts data:", error);
      }
    }
  };

  const handleAdvancedInputChange = (event) => {
    const { name, value } = event.target;
    setAdvancedInputs((prevInputs) => ({
      ...prevInputs,
      [name]: parseFloat(value), // Ensure value is a float
    }));
  };

  const handleAdvancedSubmit = async (event) => {
    event.preventDefault();
    
    if (!imageURL || !bodyPartsData) {
      console.error("Image or body parts data not available.");
      return;
    }

    try {
      const imageResponse = await fetch(imageURL);
      const blob = await imageResponse.blob();

      const formData = new FormData();
      formData.append('image', blob, 'uploaded_image.png');
      formData.append('data', JSON.stringify(bodyPartsData));
      formData.append('face', advancedInputs.face);
      formData.append('torso', advancedInputs.torso);
      formData.append('upperLegs', advancedInputs.upperLegs);
      formData.append('hips', advancedInputs.hips);
      formData.append('arms', advancedInputs.arms);
      formData.append('lowerLegs', advancedInputs.lowerLeg);

      const response = await fetch("http://localhost:5000/AdvancedWeightLoss", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const blobResponse = await response.blob();
      const url = URL.createObjectURL(blobResponse);
      setReturnedImages([url]);  // Update the first image in the rectangle
      console.log("Advanced data successfully sent and received:", url);
    } catch (error) {
      console.error("Error sending advanced data:", error);
    }
  };

  useEffect(() => {
    if (imageURL) {
      runBodysegment();
    }
  }, [imageURL, runBodysegment]);

  const handleReset = () => {
    if (imageURL) {
      runBodysegment();
    }
  };

  const handleShowAllClick = async () => {
    const buttons = document.querySelectorAll('.bmi-table button');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].click();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Delay for 500ms between clicks
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="App-title">Body Weight Loss Simulator</h1>
        <div className="controls">
          <button
            onClick={() => handleButtonClick('button1')}
            className={`toggle-button ${activeButton === 'button1' ? 'active' : ''}`}
            disabled={activeButton && activeButton !== 'button1'}
          >
            BMI
          </button>
          <button
            onClick={() => handleButtonClick('button2')}
            className={`new-button ${activeButton === 'button2' ? 'active' : ''}`}
            disabled={activeButton && activeButton !== 'button2'}
          >
            Advanced
          </button>
          <input
            type="file"
            onChange={handleImageUpload}
            accept="image/*"
            className="file-input"
          />
          {imageURL && (
            <button onClick={handleReset} className="reset-button">
              Reset
            </button>
          )}
        </div>
        <div className="content">
          <div className="left-section">
            <div className="image-container">
              {imageURL && (
                <img
                  ref={imageRef}
                  src={imageURL}
                  alt="Upload Preview"
                  className="uploaded-image"
                />
              )}
            </div>
            {activeButton === 'button1' && (
              <div className="bmi-section">
                <div className="bmi-form">
                  <h3>Calculate Your BMI</h3>
                  <input
                    type="number"
                    placeholder="Height (cm)"
                    value={height}
                    onChange={handleHeightChange}
                  />
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={weight}
                    onChange={handleWeightChange}
                  />
                  <input
                    type="number"
                    placeholder="Desired BMI"
                    value={desiredBmi}
                    onChange={handleDesiredBmiChange}
                  />
                  <button onClick={handleCalculateBmi} className="calculate-button">Calculate</button>
                  {bmi && (
                    <div className="bmi-result">
                      <h4>Your BMI: {bmi}</h4>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeButton === 'button2' && (
              <div className="advanced-section">
                <h3>Advanced Weight Loss</h3>
                <form onSubmit={handleAdvancedSubmit}>
                  <div className="input-group">
                    <label>Face:</label>
                    <input
                      type="number"
                      name="face"
                      step="0.01"
                      value={advancedInputs.face}
                      onChange={handleAdvancedInputChange}
                    />
                  </div>
                  <div className="input-group">
                    <label>Torso:</label>
                    <input
                      type="number"
                      name="torso"
                      step="0.01"
                      value={advancedInputs.torso}
                      onChange={handleAdvancedInputChange}
                    />
                  </div>
                  <div className="input-group">
                    <label>Upper Legs:</label>
                    <input
                      type="number"
                      name="upperLegs"
                      step="0.01"
                      value={advancedInputs.upperLegs}
                      onChange={handleAdvancedInputChange}
                    />
                  </div>
                  <div className="input-group">
                    <label>Hips:</label>
                    <input
                      type="number"
                      name="hips"
                      step="0.01"
                      value={advancedInputs.hips}
                      onChange={handleAdvancedInputChange}
                    />
                  </div>
                  <div className="input-group">
                    <label>Arms:</label>
                    <input
                      type="number"
                      name="arms"
                      step="0.01"
                      value={advancedInputs.arms}
                      onChange={handleAdvancedInputChange}
                    />
                  </div>
                  <div className="input-group">
                    <label>Lower Legs:</label>
                    <input
                      type="number"
                      name="lowerLeg"
                      step="0.01"
                      value={advancedInputs.lowerLeg}
                      onChange={handleAdvancedInputChange}
                    />
                  </div>
                  <button type="submit" className="submit-button">Compute</button>
                </form>
              </div>
            )}
          </div>
          <div className="right-section">
            <div className="scrollable-container">
              {returnedImages.map((url, index) => (
                <div className="image-container" key={index}>
                  <img src={url} alt="Returned Image" className="uploaded-image" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {showTable && (
          <>
            <div className="bmi-table">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Torso</th>
                    <th>Hip and Thigh</th>
                    <th>Legs</th>
                    <th>Face and Neck</th>
                    <th>Arms</th>
                    <th>Total Weight</th>
                    <th>BMI</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {weightLossData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.month}</td>
                      <td>{row.torso}</td>
                      <td>{row.hipAndThigh}</td>
                      <td>{row.legs}</td>
                      <td>{row.faceAndNeck}</td>
                      <td>{row.arms}</td>
                      <td>{row.totalWeight}</td>
                      <td>{row.bmi}</td>
                      <td><button onClick={() => handleShowClick(row.month)}>Show</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleShowAllClick} className="show-all-button">Show All</button>
          </>
        )}
      </header>
    </div>
  );
}
export default App;