﻿using UnityEngine;
using UnityEngine.UI;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.Xml;

namespace Opertoon.Stepwise {
	public class Score {

		public string title;
		public string description;
		public string primaryCredits;
		public string secondaryCredits;
		public int version;
		public Sequence[] sequences;
		public Hashtable sequencesById;
		public int sequenceIndex = 0;
		public Sequence currentSequence;
		public List<Sequence> sequenceQueue;
		public Character[] characters;
		public Hashtable charactersById;
		public Location[] locations;
		public Hashtable locationsById;
		public Location currentLocation;
		public float currentTemperature;
		public TemperatureUnits currentTemperatureUnits;
		public WeatherConditions currentWeather;
		public DateTime currentDate;
		public string type;

		public Score() {
			SetDefaults();
		}
		
		public Score( string text ) {
			SetDefaults();
			ParseMetadata( text );
			ParseStory( text );
			Init();
		}

		public Score( XmlElement xml ) {
			SetDefaults();
			ParseMetadata( xml );
			ParseStory( xml );
			Init();
		}
		
		public void SetDefaults() {

			version = 1;
			type = "basic";
			
			sequenceQueue = new List<Sequence>();
			
			XmlDocument doc = new XmlDocument();
			doc.LoadXml( "<location id=\"defaultLocation\" lat=\"0\" lon=\"0\">Default Location</location>" );
			currentLocation = new Location( doc.DocumentElement );
			
			currentTemperature = 24f;
			currentTemperatureUnits = TemperatureUnits.CELSIUS;
			
			currentWeather = WeatherConditions.CLEAR;
			
			currentDate = DateTime.Now;
			
		}

		public void ParseMetadata( string text ) {

			if ( text != null ) {
				
				string[] lines = text.Split( new string[] { "\r\n", "\n" }, StringSplitOptions.None );
				
				int i;
				int n = lines.Length;
				string line;
				string lineLower;
				string key;
				bool isUsingStepwiseKeys = false;
				for ( i = 0; i < n; i++ ) {
					
					line = lines[ i ];
					lineLower = line.ToLower();
					
					key = "stepwise.title:";
					if ( lineLower.StartsWith( key ) ) {
						title = line.Remove( 0, key.Length );
						isUsingStepwiseKeys = true;
					}
					key = "stepwise.credit:";
					if ( lineLower.StartsWith( key ) ) {
						primaryCredits = line.Remove( 0, key.Length );
						isUsingStepwiseKeys = true;
					}
					key = "stepwise.description:";
					if ( lineLower.StartsWith( key ) ) {
						description = line.Remove( 0, key.Length );
						isUsingStepwiseKeys = true;
					}
				}

				if ( !isUsingStepwiseKeys ) {
					if ( lines.Length > 0 ) {
						title = lines[ 0 ].Trim();
					}
					if ( lines.Length > 1 ) {
						primaryCredits = lines[ 1 ].Trim ();
					}
					if ( lines.Length > 2 ) {
						description = lines[ 2 ].Trim ();
					}
				}
				
				if ( title == "" ) {
					title = "Untitled";
				}
				if ( primaryCredits == "" ) {
					primaryCredits = "Author unknown";
				}
				version = 1;
				type = "basic";
				
			}
		}
		
		public void ParseMetadata( XmlElement xml ) {

			if ( xml != null ) {
				XmlNodeList elements;
				
				elements = xml.GetElementsByTagName( "title" );
				if ( elements.Count > 0 ) {
					title = elements[ 0 ].InnerText;
				}
				
				elements = xml.GetElementsByTagName( "description" );
				if ( elements.Count > 0 ) {
					description = elements[ 0 ].InnerText;
				}
				
				elements = xml.GetElementsByTagName( "primaryCredits" );
				if ( elements.Count > 0 ) {
					primaryCredits = elements[ 0 ].InnerText;
				}
				
				elements = xml.GetElementsByTagName( "secondaryCredits" );
				if ( elements.Count > 0 ) {
					secondaryCredits = elements[ 0 ].InnerText;
				}
				
				elements = xml.GetElementsByTagName( "version" );
				if ( elements.Count > 0 ) {
					version = int.Parse( elements[ 0 ].InnerText );
				}
				
				elements = xml.GetElementsByTagName( "type" );
				if ( elements.Count > 0 ) {
					type = elements[ 0 ].InnerText;
				}
			}
		}

		public void ParseStory( string text ) {

			if ( text != null ) {
				sequences = new Sequence[ 1 ];
				Sequence sequence = new Sequence( text, this );
				sequences[ 0 ] = sequence;
				sequencesById = new Hashtable();
				sequencesById[ sequence.id ] = sequence;
			}

		}

		public void ParseStory( XmlElement xml ) {

			if ( xml != null ) {

				int i, n;
				XmlNodeList elements;
				Sequence sequence;
				Character character;
				Location location;

				elements = xml.GetElementsByTagName( "sequence" );
				n = elements.Count;
				sequences = new Sequence[ n ];
				sequencesById = new Hashtable();
				for ( i = 0; i < n; i++ ) {
					sequence = new Sequence( ( XmlElement ) elements[ i ], this );
					sequences[ i ] = sequence;
					if ( sequence.id == null ) {
						sequence.id = "sequence" + i;
					}
					sequencesById[ sequence.id ] = sequence;
				}
				
				elements = xml.GetElementsByTagName( "character" );
				n = elements.Count;
				characters = new Character[ n ];
				charactersById = new Hashtable();
				for ( i = 0; i < n; i++ ) {
					character = new Character( ( XmlElement ) elements[ i ], this );
					characters[ i ] = character;
					if ( character.id == null ) {
						character.id = "character" + i;
					}
					charactersById[ character.id ] = character;
				}
				
				elements = xml.GetElementsByTagName( "location" );
				n = elements.Count;
				locations = new Location[ n ];
				locationsById = new Hashtable();
				for ( i = 0; i < n; i++ ) {
					location = new Location( ( XmlElement ) elements[ i ] );
					locations[ i ] = location;
					if ( location.id == null ) {
						location.id = "location" + i;
					}
					locationsById[ location.id ] = location;
				}

			}

		}

		public void Init() {
			int i;
			int n = sequences.Length;
			for ( i = 0; i < n; i++ ) {
				sequences[ i ].Init();
			}
		}
		
		public virtual void Reset() {
			
			int i;
			int n = sequences.Length;
			for ( i = 0; i < n; i++ ) {
				sequences[ i ].Reset();
			}
			
			sequenceIndex = 0;
			currentSequence = null;
			sequenceQueue.Clear();
		}    

		public Step NextStep() {

			Step step = null;

			UpdateCurrentSequence();

			// Debug.Log( currentSequence.id + " " + currentSequence.isExhausted );
			
			// if the sequence hasn't been exhausted, execute its next step
			if ( !currentSequence.isExhausted ) { 
				step = currentSequence.NextStep(); 
			} 
			
			return step;

		}

		public void UpdateCurrentSequence() {

			Sequence sequence;

			//Debug.Log ( "next step for score" );
			
			// if there are sequences in the queue, get the current one
			if ( sequenceQueue.Count > 0 ) { 
				sequence = sequenceQueue[ sequenceQueue.Count - 1 ]; 
				
				// if it's already completed, then
				if ( sequence.isCompleted ) {
					
					// remove it from the queue
					if ( sequenceQueue.Count > 0) {
						sequenceQueue.RemoveAt( sequenceQueue.Count - 1 );
					}
					
					// if there's still a queue, then grab the next sequence from it
					if ( sequenceQueue.Count > 0 ) {
						sequence = sequenceQueue[ sequenceQueue.Count - 1 ];
						
						// otherwise, grab the current non-queue sequence
					} else {
						sequence = sequences[ sequenceIndex ]; 
					}
				} 
				
				// grab the current non-queue sequence
			} else {
				sequence = sequences[ sequenceIndex ];
			}
			
			//Debug.Log( "current sequence: " + sequence.id );
			
			// if the sequence hasn't been exhausted, make it current
			if ( !sequence.isExhausted ) { 
				currentSequence = sequence;
			}

		}

		/**
		 * Given a sequence, makes it the current sequence.
		 *
		 * @param sequence		The sequence to make current.
		 * @param atDate		If specified, will attempt to cue up the sequence to the same date.
		 * @param autoStart		If true, the sequence will automatically play its first step.
		 */
		public void SetSequence( Sequence sequence, bool autoStart ) {
			SetSequence( sequence, DateTime.Now, autoStart );
		}

		public void SetSequence( Sequence sequence, DateTime atDate, bool autoStart ) {

			//Debug.Log ( "set sequence: " + sequence.id + " " + autoStart );

			int index = Array.IndexOf( sequences, sequence );
			if ( index != -1 ) {
				sequenceIndex = index;
				currentSequence = sequence;
				if ( atDate.Ticks != 0 ) {
					currentSequence.MatchDate( atDate );
				}
				if ( autoStart ) {
					currentSequence.NextStep();
				}
			}

		}

		public void PlaySequence( Sequence sequence ) {
			currentSequence = sequence;
			sequenceQueue.Add( sequence );
			sequence.NextStep();
		}

		/**
		 * Given an id and a type, returns the corresponding object.
		 *
		 * @param	type	The type of item to be retrieved.
		 * @param	id		The id of the sequence to be retrieved.
		 */
		public object GetItemForId( string type, string id ) {

			switch ( type ) {
				
			case "character":
				return charactersById[ id ];
				
			case "location":
				return locationsById[ id ];
				
			case "sequence":
				return sequencesById[ id ];

			default:
				return null;
				
			}

		}

		/**
		 * Given a location, makes it the current location.
		 *
		 * @param location		The location to make current.
		 */
		public void SetLocation( Location location ) {
			int index = Array.IndexOf( locations, location );
			if ( index != -1 ) {
				currentLocation = location;
			}
		}

		/**
		 * Given a temperature, makes it the current temperature.
		 *
		 * @param temperature		The temperature to make current.
		 */
		public void SetTemperature( float temperature, TemperatureUnits units ) {
			currentTemperature = temperature;
			currentTemperatureUnits = units;
		}

		/**
		 * Given weather conditions, makes them the current weather conditions.
		 *
		 * @param weather		The weather conditions to make current.
		 */
		public void SetWeather( WeatherConditions weather ) {
			currentWeather = weather;
		}

		/**
		 * Given a date, makes it the current date.
		 *
		 * @param date 			The date to make current.
		 */
		public void SetDate( DateTime date ) {
			currentDate = date;
		}

	}
}
