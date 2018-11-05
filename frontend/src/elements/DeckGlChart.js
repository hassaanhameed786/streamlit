/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import DeckGL, {
  ArcLayer,
  GridLayer,
  HexagonLayer,
  LineLayer,
  PointCloudLayer,
  ScatterplotLayer,
  ScreenGridLayer,
  TextLayer,
} from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Immutable from 'immutable';
import { Alert } from 'reactstrap';
import { StaticMap } from 'react-map-gl';

import './DeckGlChart.css';
import { dataFrameToArrayOfDicts } from '../dataFrameProto';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidGhpYWdvdCIsImEiOiJjamh3bm85NnkwMng4M3dydnNveWwzeWNzIn0.vCBDzNsEF2uFSFk2AM0WZQ';


class DeckGlChart extends PureComponent {
  constructor(props) {
    super(props);

    const specStr = this.props.element.get('spec');
    const spec = specStr ? JSON.parse(specStr) : {};
    const v = spec.viewport || {};

    this.initialViewState = {
      width: v.width || props.width,
      height: v.height || 500,
      longitude: v.longitude || 0,
      latitude: v.latitude || 0,
      pitch: v.pitch || 0,
      bearing: v.bearing || 0,
      zoom: v.zoom || 1,
    };

    this.mapStyle = getStyleUrl(v.mapStyle);

    this.fixHexLayerBug_bound = this.fixHexLayerBug.bind(this);
    this.state = { initialized: false };

    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    setTimeout(this.fixHexLayerBug_bound, 0);
  }

  fixHexLayerBug() {
    this.setState({ initialized: true });
  }

  render() {
    try {
      return (
        <div
          className="deckglchart"
          style={{
            height: this.initialViewState.height,
            width: this.initialViewState.width,
          }}
        >
          <DeckGL
            initialViewState={this.initialViewState}
            height={this.initialViewState.height}
            width={this.initialViewState.width}
            controller
            layers={this.state.initialized ? this.buildLayers() : []}
          >
            <StaticMap
              height={this.initialViewState.height}
              width={this.initialViewState.width}
              mapStyle={this.mapStyle}
              mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
            />
          </DeckGL>
        </div>
      );
    } catch (e) {
      console.error(e.stack);
      return (
        <Alert color="danger">
          <strong>{e.name}</strong>: {e.message}
        </Alert>
      );
    }
  }

  buildLayers() {
    const layers = this.props.element.get('layers');
    return layers.map(layer => buildLayer(layer)).toArray();
  }
}


DeckGlChart.propTypes = {
  element: PropTypes.instanceOf(Immutable.Map).isRequired,
  width: PropTypes.number.isRequired,
};


function buildLayer(layer) {
  const data = dataFrameToArrayOfDicts(layer.get('data'));
  const spec = JSON.parse(layer.get('spec'));
  parseEncodings(spec);

  const type = spec.type || '';
  delete spec.type;

  switch (type.toLowerCase()) {
    case 'arclayer':
      return new ArcLayer({
        data, ...Defaults.ArcLayer, ...spec
      });

    case 'gridlayer':
      return new GridLayer({
        data, ...Defaults.GridLayer, ...spec
      });

    case 'hexagonlayer':
      return new HexagonLayer({
        data, ...Defaults.HexagonLayer, ...spec
      });

    case 'linelayer':
      return new LineLayer({
        data, ...Defaults.LineLayer, ...spec
      });

    case 'pointcloudlayer':
      return new PointCloudLayer({
        data, ...Defaults.PointCloudLayer, ...spec
      });

    case 'scatterplotlayer':
      return new ScatterplotLayer({
        data, ...Defaults.ScatterplotLayer, ...spec
      });

    case 'screengridlayer':
      return new ScreenGridLayer({
        data, ...Defaults.ScreenGridLayer, ...spec
      });

    case 'textlayer':
      return new TextLayer({
        data, ...Defaults.TextLayer, ...spec
      });

    default:
      throw new Error(`Unsupported layer type "${type}"`);
  }
}


/**
 * Take a short "map style" string and convert to the full URL for the style.
 * (And it only does this if the input string is not already a URL.)
 *
 * See https://www.mapbox.com/maps/ or https://www.mapbox.com/mapbox-gl-js/api/
 */
function getStyleUrl(styleStr = 'light-v9') {
  if (
    styleStr.startsWith('http://') ||
    styleStr.startsWith('https://') ||
    styleStr.startsWith('mapbox://')) {
    return styleStr;
  }

  return `mapbox://styles/mapbox/${styleStr}`;
}


/**
 * Returns the first non-null/non-undefined argument.
 *
 * Usage:
 *   fallback(value, fallbackValue)
 *
 * Accepts infinitely many arguments:
 *   fallback(value, fallback1, fallback2, fallback3)
 */
function fallback(...args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] != null) return args[i];
  }
  return null;
}


/* Define a bunch of getters */

function getPositionFromLatLonColumns(d) {
  return [fallback(d.longitude, d.lon), fallback(d.latitude, d.lat)];
}

function getEndPositionFromLatLonColumn(d) {
  return [fallback(d.longitude2, d.lon2), fallback(d.latitude2, d.lat2)];
}

function getPositionFromPositionXYZColumns(d) {
  return [
    fallback(d.longitude, d.lon, d.positionX, d.x),
    fallback(d.latitude, d.lat, d.positionY, d.y),
    fallback(d.latitude, d.lat, d.positionZ, d.z),
  ];
}

function getNormalFromNormalXYZColumns(d) {
  return [d.normalX, d.normalY, d.normalZ];
}

const DEFAULT_COLOR = [200, 30, 0, 160];

function getColorFromColorRGBAColumns(d) {
  return d.colorR && d.colorG && d.colorB ?
    [d.colorR, d.colorG, d.colorB, d.colorA == null ? 255 : d.colorA] :
    DEFAULT_COLOR;
}

function getSourceColorFromSourceColorRGBAColumns(d) {
  return d.sourceColorR && d.sourceColorG && d.sourceColorB ?
    [d.sourceColorR, d.sourceColorG, d.sourceColorB,
      d.sourceColorA == null ? 255 : d.sourceColorA] :
    DEFAULT_COLOR;
}

function getTargetColorFromTargetColorRGBAColumns(d) {
  return d.targetColorR && d.targetColorG && d.targetColorB ?
    [d.targetColorR, d.targetColorG, d.targetColorB,
      d.targetColorA == null ? 255 : d.targetColorA] :
    DEFAULT_COLOR;
}

/**
 * Converts spec from
 *
 *     {
 *       ...
 *       encoding: {
 *         foo: 'bar',
 *       },
 *       ...
 *     }
 *
 * to:
 *
 *     {
 *       ...
 *       getFoo: d => d.bar,
 *       ...
 *     }
 */
function parseEncodings(spec) {
  /* eslint-disable no-param-reassign */
  const { encoding } = spec;
  if (!encoding) return;

  delete spec.encoding;

  Object.keys(encoding).forEach((key) => {
    const v = encoding[key];
    spec[makeGetterName(key)] =
        typeof v === 'string' ?
          d => d[v] :
          () => v;
  });
}


/**
 * Convert a string 'foo' to its getter name 'getFoo', if needed.
 */
function makeGetterName(key) {
  if (key.startsWith('get')) return key;
  return `get${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}


/**
 * Defines default getters for columns.
 */
const Defaults = {
  ArcLayer: {
    getSourceColor: getSourceColorFromSourceColorRGBAColumns,
    getTargetColor: getTargetColorFromTargetColorRGBAColumns,
    getSourcePosition: getPositionFromLatLonColumns,
    getTargetPosition: getEndPositionFromLatLonColumn,
  },

  // GeoJsonLayer: TODO. Data needs to be sent as JSON, not dataframe.

  GridLayer: {
    getPosition: getPositionFromLatLonColumns,
  },

  HexagonLayer: {
    getPosition: getPositionFromLatLonColumns,
  },

  LineLayer: {
    getSourcePosition: getPositionFromLatLonColumns,
    getTargetPosition: getEndPositionFromLatLonColumn,
  },

  // IconLayer: TODO
  // PathLayer: TODO

  PointCloudLayer: {
    getColor: getColorFromColorRGBAColumns,
    getPosition: getPositionFromPositionXYZColumns,
    getNormal: getNormalFromNormalXYZColumns,
  },

  // PolygonLayer: TODO

  ScatterplotLayer: {
    getColor: getColorFromColorRGBAColumns,
    getPosition: getPositionFromLatLonColumns,
    getRadius: d => fallback(d.radius, 100),
  },

  ScreenGridLayer: {
    getPosition: getPositionFromLatLonColumns,
    getWeight: d => d.weight,
  },

  TextLayer: {
    getColor: getColorFromColorRGBAColumns,
    getPixelOffset:
        d => [fallback(d.pixelOffsetX, 0), fallback(d.pixelOffsetY, 0)],
    getPosition: getPositionFromLatLonColumns,
  },
};


export default DeckGlChart;